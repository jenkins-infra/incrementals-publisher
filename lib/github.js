/*
 * This module provides some helpers for working with GitHub for the
 * incrementals publishing
 */

import {Octokit} from "@octokit/rest";

import {createAppAuth} from "@octokit/auth-app";

const APP_ID = process.env.GITHUB_APP_ID;
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;

const INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID || 22187127

async function getRestClient() {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: APP_ID,
      privateKey: PRIVATE_KEY,
      installationId: INSTALLATION_ID
    }
  })
}

function summary(entries) {
  const links = `#### Download link${entries.length > 1 ? "s" : ""}:\n${entries.map(entry => `- [${entry.artifactId}](${entry.url})`).join("\n")}`

  const hpi = entries
    .filter(entry => entry.packaging == "hpi")
    .map(entry => `${entry.artifactId}:incrementals;${entry.groupId};${entry.version}`)

  // Output the input format section only if there is a plugin, not usable with other type of artifact
  return hpi.length == 0 ? links : `${links}\n\n#### Plugin Installation Manager input format: ([documentation](https://github.com/jenkinsci/plugin-installation-manager-tool/#plugin-input-format))\n<pre>${hpi.join("\n")}</pre>`
}

function text(entries) {
  const metadata = entries
    .map(entry => `&#60;dependency>&#xA;  &#60;groupId>${entry.groupId}&#60;/groupId>&#xA;  &#60;artifactId>${entry.artifactId}&#60;/artifactId>&#xA;  &#60;version>${entry.version}&#60;/version>&#xA;&#60;/dependency>`)
    .join("&#xA;")

  return `<pre>${metadata}</pre>`
}

export default {
  commitExists: async (owner, repo, ref) => {
    const github = await getRestClient();
    /*
    * Ensure that the commit is actually present in our repository! No sense
    * doing any work with it if it's somehow not published.
    */
    const commit = await github.repos.getCommit({owner, repo, ref});
    // Here is where you could port https://github.com/jglick/incrementals-downstream-publisher/blob/10073f484d35edc3928f7808419c81a6eb48df62/src/main/java/io/jenkins/tools/incrementals_downstream_publisher/Main.java#L107-L111
    // so as to print information about commit signatures, or even enforce them.
    return !!commit;
  },

  createStatus: async (owner, repo, head_sha, entries) => {
    const github = await getRestClient();

    return github.rest.checks.create({
      owner,
      repo,
      name: "Incrementals",
      head_sha,
      status: "completed",
      conclusion: "success",
      details_url: entries[0].url,
      output: {
        title: `Deployed version ${entries[0].version} to Incrementals`,
        summary: summary(entries),
        text: text(entries)
      }
    });
  }
};
