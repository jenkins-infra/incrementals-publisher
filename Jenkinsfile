if (JENKINS_URL.contains('infra.ci.jenkins.io')) {
  buildDockerAndPublishImage('incrementals-publisher')
  return
}

if (JENKINS_URL.contains('ci.jenkins.io')) {
  properties([
      buildDiscarder(logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '5')),
      disableConcurrentBuilds(),
      disableResume()
  ])
  node('docker&&linux') {
    timeout(60) {
      ansiColor('xterm') {
        stage('NPM Install') {
          runDockerCommand('node:14',  'npm ci')
        }
        stage('Lint and Test') {
          runDockerCommand('node:14',  'npm run test')
        }
      }
    }
  }
}

def runDockerCommand(image, cmd) {
  sh """
    docker run \
      --network host \
      --rm \
      -w "\$PWD" \
      -v "\$PWD:\$PWD" \
      -u \$(id -u):\$(id -g) \
      $image \
      $cmd
  """
}
