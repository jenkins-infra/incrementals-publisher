import {readFileSync} from "fs";
import assert from "assert";
import simple from "simple-mock";
// eslint-disable-next-line
import fetch from "node-fetch";
import path from "path";
import {IncrementalsPlugin} from "../IncrementalsPlugin.js";
import permissions from "../lib/permissions.js";

const readJSON = (filename) => JSON.parse(readFileSync(new URL(filename, import.meta.url)));

const urlResults = {
  "https://repo.jenkins-ci.org/incrementals/io/jenkins/tools/bom/bom-2.222.x/29-rc793.5055257e4d28/bom-2.222.x-29-rc793.5055257e4d28.pom": {
    status: 404
  },
  "https://ci.jenkins.io/job/Tools/job/bom/job/PR-22/5/api/json?tree=actions[revision[hash,pullHash]]": {
    status: 200,
    results: () => {
      return {
        actions: [{
          "_class": "jenkins.scm.api.SCMRevisionAction",
          "revision": {
            "_class": "org.jenkinsci.plugins.github_branch_source.PullRequestSCMRevision",
            "pullHash": "5055257e4d28adea76fc34fdde4e025347405bae"
          }
        }]
      }
    }
  },
  "https://ci.jenkins.io/job/Tools/job/bom/job/PR-22/5/../../../api/json?tree=sources[source[repoOwner,repository]]": {
    status: 200,
    results: () => {
      return {"_class": "org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject", "sources": [{"source": {"_class": "org.jenkinsci.plugins.github_branch_source.GitHubSCMSource", "repoOwner": "jenkinsci", "repository": "bom"}}]}
    }
  },
  "https://ci.jenkins.io/job/Infra/job/repository-permissions-updater/job/master/lastSuccessfulBuild/artifact/json/github.index.json": {
    status: 200,
    results: () => readJSON("./fixtures-permissions.json")
  },
  "https://fake-repo.jenkins-ci.org/incrementals/io/jenkins/tools/bom/bom-2.222.x/29-rc793.5055257e4d28/bom-2.222.x-29-rc793.5055257e4d28.pom": {
    status: 404,
    results: () => "Not found"
  }
}

describe("Handling incremental publisher webhook events", function () {
  let ctx = {};
  let data = {
    body: {}
  };
  let run = async () => {
    ctx.res = {};
    try {
      const obj = new IncrementalsPlugin(ctx, data);
      ctx.res = await obj.main();
    } catch (err) {
      ctx.res = {
        status: err.code || 400,
        body: err.message || "Unknown error"
      };
    }
  };
  let asyncFetch = async (url, opts) => {
    if (!url) {
      throw new Error("no url provided");
    }
    if (!urlResults[url]) {
      console.warn("Mock URL is not found, fetching real url", url);
      return fetch(url, opts);
    }
    return {
      status: urlResults[url].status,
      json: () => {const resultsFunc = urlResults[url].results; return resultsFunc()}
    };
  }

  beforeEach(function () {
    ctx.log = simple.mock();
    //simple.mock(ctx.log, 'info', (...args) => console.log('[INFO]', ...args));
    //simple.mock(ctx.log, 'error', (...args) => console.log('[ERROR]', ...args));
    simple.mock(ctx.log, "info", () => true);
    simple.mock(ctx.log, "error", () => true);
    simple.mock(IncrementalsPlugin.prototype, "downloadFile", async () => path.resolve("./test/fixtures-good-archive.zip"));
    simple.mock(IncrementalsPlugin.prototype.github, "commitExists", async () => true);
    simple.mock(IncrementalsPlugin.prototype.github, "createStatus", async () => true);
    simple.mock(IncrementalsPlugin.prototype, "uploadToArtifactory", async () => {
      return {
        status: 200,
        statusText: "Success"
      };
    });
    simple.mock(IncrementalsPlugin.prototype, "fetch", asyncFetch);
    simple.mock(IncrementalsPlugin.prototype.permissions, "fetch", async () => {
      return {
        status: 200,
        json: async () => readJSON("./fixtures-permissions.json")
      }
    });
  });
  afterEach(function () {simple.restore()});

  describe("without parameters", function () {
    it("should require a parameter", async function () {
      await run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, "The incrementals-publisher invocation was missing the build_url attribute");
    });
  });

  describe("without a build_url matching JENKINS_HOST", function () {
    it("should return a 400", async function () {
      data.body.build_url = "https://example.com/foo/bar";
      await run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, "This build_url is not supported");
    });
  });

  describe("with a weird build_url", function () {
    it("should return a 400", async function () {
      data.body.build_url = "https://ci.jenkins.io/junk/";
      await run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, "This build_url is malformed");
    });
  });

  describe("with a bogus build_url", function () {
    for (let u of [
      "https://ci.jenkins.io/job/hack?y/123/",
      "https://ci.jenkins.io/job/hack#y/123/",
      // There may be legitimate use cases for, say, %20, but validation might be tricky and YAGNI.
      "https://ci.jenkins.io/job/hack%79/123/",
      "https://ci.jenkins.io/job/../123/",
      "https://ci.jenkins.io/job/./123/",
      "https://ci.jenkins.io/job/ok/123//",
    ]) {
      it(u + " should return a 400", async function () {
        data.body.build_url = u;
        await run();
        assert.equal(ctx.res.status, 400);
        assert.equal(ctx.res.body, "This build_url is malformed");
      });
    }
  });
  describe("error verifying permissions", function () {
    beforeEach(function () {
      simple.mock(permissions, "verify", () => {
        return new Promise(function (resolve, reject) {
          reject(new Error("This is my error"));
        });
      });
    });
    it("should output an error", async function () {
      data.body.build_url = "https://ci.jenkins.io/job/Tools/job/bom/job/PR-22/5/";
      await run();
      assert.equal(ctx.res.body, "Invalid archive retrieved from Jenkins, perhaps the plugin is not properly incrementalized?\nError: This is my error from https://ci.jenkins.io/job/Tools/job/bom/job/PR-22/5/artifact/**/*5055257e4d28*/*5055257e4d28*/*zip*/archive.zip");
      assert.equal(ctx.res.status, 400);
    });
  });
  describe("success", function () {
    it("should claim all is a success", async function () {
      data.body.build_url = "https://ci.jenkins.io/job/Tools/job/bom/job/PR-22/5/";
      await run();
      assert.equal(ctx.res.body, "Response from Artifactory: Success\n");
      assert.equal(ctx.res.status, 200);
    });
  });
});
