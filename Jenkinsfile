if (JENKINS_URL.contains('infra.ci.jenkins.io')) {
  buildDockerAndPublishImage('incrementals-publisher')
  return
}

if (JENKINS_URL.contains('ci.jenkins.io')) {
  pipeline {
    agent {
      label 'docker&&linux'
    }

    options {
      timeout(time: 60, unit: 'MINUTES')
      ansiColor('xterm')
      buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '5', numToKeepStr: '5')
    }

    stages {

      stage('NPM Install') {
        steps {
          runDockerCommand('node:14',  'npm ci')
        }
      }

      stage('Lint and Test') {
        steps {
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
