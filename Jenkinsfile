if (JENKINS_URL.contains('infra.ci.jenkins.io')) {
  buildDockerAndPublishImage('incrementals-publisher', [automaticSemanticVersioning: true])
  return
}

if (JENKINS_URL.contains('ci.jenkins.io')) {
  pipeline {
    options {
      timeout(time: 60, unit: 'MINUTES')
      ansiColor('xterm')
      disableConcurrentBuilds(abortPrevious: true)
      buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '5')
    }

    agent {
      label 'node'
    }

    environment {
      NODE_ENV = 'production'
      TZ = "UTC"
      NETLIFY = "true"
      HOME = "${WORKSPACE}"
    }

    stages {
      stage('Check for typos') {
        steps {
          sh '''typos --format json | typos-checkstyle - > checkstyle.xml || true'''
        }
        post {
          always {
            recordIssues(tools: [checkStyle(id: 'typos', name: 'Typos', pattern: 'checkstyle.xml')])
          }
        }
      }

      stage('Install Dependencies') {
        environment {
          NODE_ENV = 'development'
        }
        steps {
          sh 'asdf install'
          sh 'npm ci'
        }
      }

      stage('Lint') {
        steps {
          sh '''
            npx eslint --format checkstyle . > eslint-results.json
          '''
        }
        post {
          always {
            recordIssues(tools: [
                esLint(pattern: 'eslint-results.json'),
            ])
          }
        }
      }

      stage('Test') {
        steps {
          sh 'npm run test --if-present'
        }
      }

      stage('Build') {
        steps {
          sh 'npm run build --if-present'
        }
      }
    }
  }
}
