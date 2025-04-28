pipeline {
  options {
    timeout(time: 60, unit: 'MINUTES')
    ansiColor('xterm')
    disableConcurrentBuilds(abortPrevious: true)
    buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '5')
  }

  agent {
    label 'linux-arm64-docker || arm64linux'
  }

  environment {
    NODE_ENV = 'production'
    TZ = "UTC"
    NETLIFY = "true"
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
          recordIssues(
            enabledForFailure: true,
            tools: [
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

    stage('Release') {
      steps {
        buildDockerAndPublishImage('incrementals-publisher', [targetplatforms: 'linux/amd64,linux/arm64', disablePublication: !infra.isInfra()])
      }
    }
  }
}
