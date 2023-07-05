/*
 * This module just has some helpers to make checking permissions easier
 */

import fetch from "node-fetch";

import StreamZip from "node-stream-zip";
import util from "util";
import xml2js from "xml2js";
import config from "./config.js";
import wcmatch from "wildcard-match";

export default {
  fetch: () => {
    return fetch(config.PERMISSIONS_URL);
  },

  verify: async (log, target, archive, entries, permsResponse, hash) => {
    const permissions = await permsResponse.json();
    return new Promise((resolve, reject) => {
      const applicable = permissions[target];

      if (!applicable) {
        reject(util.format("No applicable permissions for %s, check jenkins-infra/repository-permissions-updater has the right configuration,", target));
        return
      }

      const zip = new StreamZip({file: archive});

      zip.on("entry", async function (entry) {
        let ok = !!applicable.find(file => {
          const isMatch = wcmatch(file, { separator: "|" })
          return isMatch(entry.name) || entry.name.startsWith(file);
        });
        if (!ok) {
          this.emit("error", new Error(util.format("No permissions for %s", entry.name)));
          return
        }
        if (entry.name.endsWith(".pom")) {
          const pomXml = zip.entryDataSync(entry.name);
          xml2js.parseString(pomXml, (err, result) => {
            if (!result.project.scm) {
              this.emit("error", new Error(util.format("Missing <scm> section in %s", entry.name)));
              return
            }
            const scm = result.project.scm[0];
            if (!scm.url) {
              this.emit("error", new Error(util.format("Missing <url> section in <scm> of %s", entry.name)));
              return
            }
            const url = scm.url[0];
            if (!scm.tag) {
              this.emit("error", new Error(util.format("Missing <tag> section in <scm> of %s", entry.name)));
              return
            }
            const tag = scm.tag[0];
            const groupId = result.project.groupId[0];
            const artifactId = result.project.artifactId[0];
            const version = result.project.version[0];
            entries.push({
              artifactId,
              path: entry.name
            });
            log.info(util.format("Parsed %s with url=%s tag=%s GAV=%s:%s:%s", entry.name, url, tag, groupId, artifactId, version));
            const expectedPath = groupId.replace(/[.]/g, "/") + "/" + artifactId + "/" + version + "/" + artifactId + "-" + version + ".pom";
            if (tag !== hash) {
              this.emit("error", new Error(`Wrong commit hash in /project/scm/tag, expected ${hash}, got ${tag}`));
              return
            } else if (!url.match("^https?://github[.]com/.+$")) {
              this.emit("error", new Error("Wrong URL in /project/scm/url"));
              return
            } else if (expectedPath !== entry.name) {
              this.emit("error", new Error(util.format("Wrong GAV: %s vs. %s", expectedPath, entry.name)));
              return
            }
          });
        }
      });

      zip.on("ready", () => {
        zip.close();
        resolve(true);
      });

      zip.on("error", (err) => { reject(new Error("ZIP error: " + err)); });
    });
  },
};
