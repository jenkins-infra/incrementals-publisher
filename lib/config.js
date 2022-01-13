module.exports = {};
Object.entries({
  GITHUB_APP_ID: 'invalid-dummy-id',
  GITHUB_APP_PRIVATE_KEY: 'invalid-dummy-secret',
  PERMISSIONS_URL: 'https://ci.jenkins.io/job/Infra/job/repository-permissions-updater/job/master/lastSuccessfulBuild/artifact/json/github.index.json',
  JENKINS_HOST: 'https://ci.jenkins.io/',
  INCREMENTAL_URL: 'https://repo.jenkins-ci.org/incrementals/',
  ARTIFACTORY_KEY: 'invalid-key',
  JENKINS_AUTH: '',
  PORT: '3000',
  BUILD_METADATA_URL: '',
  FOLDER_METADATA_URL: '',
  ARCHIVE_URL: '',
  PRESHARED_KEY: '',
}).forEach(([key, value]) => {
  Object.defineProperty(module.exports, key, {
    get() { return process.env[key] || value },
    enumerable: true,
    configurable: false
  });
});
