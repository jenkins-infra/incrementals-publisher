// infra.ci.jenkins.io defaults to arm64 container agents (faster in Azure) while ci.jenkins.io has the default spot amd64 used by Java builds (faster in AWS).
final String agentLabel = infra.isInfra() ? 'jnlp-linux-arm64' : 'maven-25'

pipeline {
  options {
    timeout(time: 60, unit: 'MINUTES')
    ansiColor('xterm')
    disableConcurrentBuilds(abortPrevious: true)
    buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '5')
  }

  agent {
    label agentLabel
  }

  environment {
    NODE_ENV = 'production'
    TZ = "UTC"
    NETLIFY = "true"
  }

  stages {
    stage('Check for typos') {
      steps {
        sh '''typos --format sarif > typos.sarif || true'''
      }
      post {
        always {
          recordIssues(tools: [sarif(id: 'typos', name: 'Typos', pattern: 'typos.sarif')])
        }
      }
    }

    stage('Install Dependencies') {
      environment {
        NODE_ENV = 'development'
      }
      steps {
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
        buildDockerAndPublishImage('incrementals-publisher', [
          publishToPrivateAzureRegistry: true,
          targetplatforms: 'linux/arm64', 
          disablePublication: !infra.isInfra(),
        ])
      }
    }
  }
}
