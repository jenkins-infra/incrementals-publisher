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

    const metadata = `<pre>&#xA;<dependency>&#xA;  <groupId>${entries[0].groupId}</groupId>&#xA;  <artifactId>${entries[0].artifactId}</artifactId>&#xA;  <version>${entries[0].version}</version>&#xA;</dependency>&#xA;`

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
        summary: entries.map(entry => `- [${entry.artifactId}](${entry.url})`).join("\n"),
        text: metadata
      }
    });
  }
};
