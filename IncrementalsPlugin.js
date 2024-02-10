/*
 * This Azure Function is responsible for processing information related to an
 * incrementals release and bouncing the artifacts into Artifactory
 */

import fs from "fs";

import fetch from "node-fetch";
import os from "os";
import path from "path";
import util from "util";
import url from "url";
import config from "./lib/config.js";
import github from "./lib/github.js";
import pipeline from "./lib/pipeline.js";
import permissions from "./lib/permissions.js";

const TEMP_ARCHIVE_DIR = path.join(os.tmpdir(), "incrementals-");
const mkdtemp = util.promisify(fs.mkdtemp);

/*
 * Small helper function to make failing a request more concise
 */
class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

class FailRequestError extends ExtendableError {
  constructor(message, code = 400) {
    super(message);
    this.code = code;
  }
}

class SuccessRequestError extends ExtendableError {
  // ignorable, error, don't fail the build
  constructor(message, code = 200) {
    super(message);
    this.code = code;
  }
}


class IncrementalsPlugin {
  constructor(context, data) {
    this.context = context;
    this.data = data;
  }

  get permissions() {
    return permissions;
  }

  get github() {
    return github
  }

  get pipeline() {
    return pipeline
  }

  // wrapper for easier mocking
  fetch(...args) {
    return fetch(...args);
  }

  async uploadToArtifactory(archivePath, pomURL) {
    const upload = await this.fetch(util.format("%sarchive.zip", config.INCREMENTAL_URL),
      {
        headers: {
          "X-Explode-Archive": true,
          "X-Explode-Archive-Atomic": true,
          "X-JFrog-Art-Api": config.ARTIFACTORY_KEY,
        },
        method: "PUT",
        body: fs.createReadStream(archivePath)
      });
    this.context.log.info("Upload result for pom: %s, status: %s, full error: %s", pomURL, upload.status, await upload.text());
    return upload;
  }


  async downloadFile(archiveUrl, fetchOpts) {
    let tmpDir = await mkdtemp(TEMP_ARCHIVE_DIR);
    this.context.log.info("Prepared a temp dir for the archive %s", tmpDir);
    const archivePath = path.join(tmpDir, "archive.zip");

    const res = await fetch(archiveUrl, fetchOpts)
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(archivePath);
      res.body.pipe(fileStream);
      res.body.on("error", (err) => {
        fileStream.close();
        reject(err);
      });
      fileStream.on("finish", function () {
        fileStream.close();
        resolve();
      });
    });

    return archivePath
  }

  isValidUrl(buildUrl) {
    const parsedUrl = url.parse(buildUrl);
    const parsedJenkinsHost = url.parse(config.JENKINS_HOST);

    if (`${parsedUrl.protocol}//${parsedUrl.host}` != `${parsedJenkinsHost.protocol}//${parsedJenkinsHost.host}`) {
      throw new FailRequestError("This build_url is not supported");
    }
    if (!parsedUrl.path.match("/(job/[a-zA-Z0-9._-]+/)+[0-9]+/$") || buildUrl.includes("/../") || buildUrl.includes("/./")) {
      throw new FailRequestError("This build_url is malformed");
    }
  }

  async main() {
    const buildUrl = this.data.body.build_url;
    /* If we haven't received any valid data, just bail early */
    if (!buildUrl) {
      throw new FailRequestError("The incrementals-publisher invocation was missing the build_url attribute")
    }

    try {
      this.isValidUrl(buildUrl);
    } catch (buildUrlError) {
      this.context.log.error("Malformed", {buildUrl: buildUrl, JENKINS_HOST: config.JENKINS_HOST});
      throw buildUrlError;
    }

    // Starting some async operations early which we will need later
    let perms = this.permissions.fetch();

    const jenkinsOpts = {};
    if (config.JENKINS_AUTH) {
      jenkinsOpts.headers = {"Authorization": "Basic " + new Buffer.from(config.JENKINS_AUTH, "utf8").toString("base64")};
    }

    /*
     * The first step is to take the buildUrl and fetch some metadata about this
     * specific Pipeline Run
     */
    let buildMetadataUrl = config.BUILD_METADATA_URL || this.pipeline.getBuildApiUrl(buildUrl);
    this.context.log.info("Retrieving metadata from %s", buildMetadataUrl)
    let buildMetadata = await this.fetch(buildMetadataUrl, jenkinsOpts);
    if (buildMetadata.status !== 200) {
      this.context.log.error("Failed to fetch Pipeline build metadata", buildMetadata);
    }
    let buildMetadataJSON = await buildMetadata.json();

    if (!buildMetadataJSON) {
      this.context.log.error("I was unable to parse any build JSON metadata", buildMetadata);
      throw new FailRequestError();
    }
    let buildMetadataParsed = this.pipeline.processBuildMetadata(buildMetadataJSON);

    if (!buildMetadataParsed.hash) {
      this.context.log.error("Unable to retrieve a hash or pullHash", buildMetadataJSON);
      throw new SuccessRequestError(`Did not find a Git commit hash associated with this build. Some plugins on ${config.JENKINS_HOST} may not yet have been updated with JENKINS-50777 REST API enhancements. Skipping deployment.\n`)
    }

    let folderMetadata = await this.fetch(config.FOLDER_METADATA_URL || this.pipeline.getFolderApiUrl(buildUrl), jenkinsOpts);
    if (folderMetadata.status !== 200) {
      this.context.log.error("Failed to fetch Pipeline folder metadata", folderMetadata);
    }
    let folderMetadataJSON = await folderMetadata.json();
    if (!folderMetadataJSON) {
      this.context.log.error("I was unable to parse any folder JSON metadata", folderMetadata);
      throw new FailRequestError();
    }
    let folderMetadataParsed = this.pipeline.processFolderMetadata(folderMetadataJSON);
    if (!folderMetadataParsed.owner || !folderMetadataParsed.repo) {
      this.context.log.error("Unable to retrieve an owner or repo", folderMetadataJSON);
      throw new FailRequestError("Unable to retrieve an owner or repo");
    }

    if (!(await this.github.commitExists(folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash))) {
      this.context.log.error("This request was using a commit which does not exist, or was ambiguous, on GitHub!", buildMetadataParsed.hash);
      throw new FailRequestError("Could not find commit (non-existent or ambiguous)");
    }
    this.context.log.info("Metadata loaded repo: %s/%s hash: %s", folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash);

    /*
     * Once we have some data about the Pipeline, we can fetch the actual
     * `archive.zip` which has all the right data within it
     */
    let archiveUrl = config.ARCHIVE_URL || this.pipeline.getArchiveUrl(buildUrl, buildMetadataParsed.hash);

    const archivePath = await this.downloadFile(archiveUrl, jenkinsOpts)
    this.context.log.info("Downloaded archiveURL: %s to path: %s", archiveUrl, archivePath);


    /*
     * Once we have an archive.zip, we need to check our permissions based off of
     * the repository-permissions-updater results
     */
    perms = await perms;
    if (perms.status !== 200) {
      this.context.log.error("Failed to get our permissions %o", perms);
      throw new FailRequestError("Failed to retrieve permissions");
    }
    const repoPath = util.format("%s/%s", folderMetadataParsed.owner, folderMetadataParsed.repo);
    let entries = [];
    this.context.log.info("Downloaded file size %d", fs.statSync(archivePath).size);
    try {
      await this.permissions.verify(this.context.log, repoPath, archivePath, entries, perms, buildMetadataParsed.hash);
    } catch (err) {
      this.context.log.error("Invalid archive %o", err);
      throw new FailRequestError(`Invalid archive retrieved from Jenkins, perhaps the plugin is not properly incrementalized?\n${err} from ${archiveUrl}`);
    }

    if (entries.length === 0) {
      this.context.log.error("Empty archive");
      throw new SuccessRequestError(`Skipping deployment as no artifacts were found with the expected path, typically due to a PR merge build not up to date with its base branch: ${archiveUrl}\n`)
    }
    this.context.log.info("Archive entries %o", entries);

    const pom = entries[0].path;
    this.context.log.info("Found a POM %s", pom);
    const pomURL = config.INCREMENTAL_URL + pom;
    const check = await this.fetch(pomURL);
    if (check.status === 200) {
      this.context.log.info("Already exists for pom: %s", pomURL);
      throw new SuccessRequestError(`Already deployed, not attempting to redeploy: ${pomURL}\n`)
    }

    /*
     * Finally, we can upload to Artifactory
     */
    const upload = await this.uploadToArtifactory(archivePath, pomURL);

    const entriesForDisplay = entries.map(entry => {
      return {
        artifactId: entry.artifactId,
        url: config.INCREMENTAL_URL + entry.path.replace(/[^/]+$/, ""),
        version: entry.path.split("/").slice(-2)[0],
        groupId: entry.path.split("/").slice(0, 3).join(".")
      };
    })

    const result = await this.github.createStatus(folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash, entriesForDisplay)
      // ignore any actual errors, just log it
      .catch(err => err);

    if (result.status >= 300) {
      this.context.log.error("Failed to create github status, code: %d for repo: %s/%s, check your GitHub credentials, err: %s", result.status, folderMetadataParsed.owner, folderMetadataParsed.repo, result);
    } else {
      this.context.log.info("Created github status for pom: %s", pom);
    }

    return {
      status: upload.status,
      body: "Response from Artifactory: " + upload.statusText + "\n"
    };
  }
}

export {IncrementalsPlugin};
