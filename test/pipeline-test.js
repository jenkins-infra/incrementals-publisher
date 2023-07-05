import assert from "assert";
import pipeline from "../lib/pipeline.js";

describe("The Pipeline helpers", function() {
  let build_url = "https://ci.jenkins.io/job/structs-plugin/job/PR-36/3/";

  describe("processBuildMetadata", function() {
    let metadata = {
      "_class": "org.jenkinsci.plugins.workflow.job.WorkflowRun",
      "actions": [
        {
          "_class": "hudson.model.CauseAction"
        },
        {
          "_class": "jenkins.scm.api.SCMRevisionAction",
          "revision": {
            "_class": "jenkins.plugins.git.AbstractGitSCMSource$SCMRevisionImpl",
            "hash": "abc131cc3bf56309a05b3fe8b086b265d14f2a61"
          }
        },
        {
          "_class": "hudson.plugins.git.util.BuildData"
        },
        {
          "_class": "hudson.plugins.git.GitTagAction"
        },
        {

        },
        {
          "_class": "org.jenkinsci.plugins.workflow.cps.EnvActionImpl"
        },
        {

        },
        {

        },
        {
          "_class": "org.jenkinsci.plugins.workflow.job.views.FlowGraphAction"
        },
        {

        },
        {

        }
      ]
    };

    it("should return the right hash", function() {
      const value = pipeline.processBuildMetadata(metadata);
      assert.equal(value.hash, "abc131cc3bf56309a05b3fe8b086b265d14f2a61");
    });

    let metadata2 = { // https://ci.jenkins.io/job/Core/job/jenkins/job/master/888/api/json?tree=actions[revision[hash,pullHash]]&pretty
      "_class": "org.jenkinsci.plugins.workflow.job.WorkflowRun",
      "actions": [
        {
          "_class": "hudson.model.CauseAction"
        },
        {
          "_class": "jenkins.metrics.impl.TimeInQueueAction"
        },
        {

        },
        {
          "_class": "jenkins.scm.api.SCMRevisionAction",
          "revision": {
            "_class": "jenkins.plugins.git.AbstractGitSCMSource$SCMRevisionImpl"
          }
        },
        {

        },
        {
          "_class": "hudson.plugins.git.util.BuildData"
        },
        {
          "_class": "hudson.plugins.git.GitTagAction"
        },
        {

        },
        {
          "_class": "hudson.plugins.git.util.BuildData"
        },
        {
          "_class": "org.jenkinsci.plugins.workflow.cps.EnvActionImpl"
        },
        {
          "_class": "hudson.plugins.git.util.BuildData"
        },
        {

        },
        {

        },
        {
          "_class": "hudson.tasks.junit.TestResultAction"
        },
        {

        },
        {

        },
        {

        },
        {

        },
        {

        },
        {

        },
        {
          "_class": "org.jenkinsci.plugins.workflow.job.views.FlowGraphAction"
        },
        {

        },
        {

        }
      ]
    };

    it("should return no hash", function() {
      const value = pipeline.processBuildMetadata(metadata2);
      assert.equal(value.hash, null);
    });

    it("gracefully tolerates lack of any authentication", function() {
      const value = pipeline.processBuildMetadata({});
      assert.equal(value.hash, null);
    });
  });

  describe("getBuildApiUrl", function() {
    it("should generate an api/json URL", function() {
      const url = pipeline.getBuildApiUrl(build_url);
      assert.ok(url);
      assert.ok(url.match("api/json"));
    });
  });

  describe("getArchiveUrl", function() {
    it("should generate an archive.zip URL", function() {
      let hash = "acbd4";
      const url = pipeline.getArchiveUrl(build_url, hash);
      assert.strictEqual(url, "https://ci.jenkins.io/job/structs-plugin/job/PR-36/3/artifact/**/*a*cb*d4*/*a*cb*d4*/*zip*/archive.zip");
    });
  });

});
