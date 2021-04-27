const path        = require('path');
const assert      = require('assert');
const Permissions = require('../lib/permissions');

describe('The Permissions helpers', function() {
  it('Fails with bad url error', async function() {
    const folderMetadataParsed = {
      owner: 'jenkinsci',
      repo: 'bom'
    }
    const buildMetadataParsed = {
      hash: '149af85f094da863ddc294e50b5d8caaab549f95'
    }

    const repoPath = path.join(folderMetadataParsed.owner, folderMetadataParsed.repo);
    const entries = [];
    let perms = {
      status: 200,
      json: () => require('./fixtures-permissions.json')
    }
    assert.rejects(
      () =>  Permissions.verify(
        { info: () => true },
        repoPath,
        path.resolve('./test/fixtures-bad-scm-url-archive.zip'),
        entries,
        perms,
        buildMetadataParsed.hash
      ),
      {
        name: 'Error',
        message: 'ZIP error: Error: Missing <url> section in <scm> of io/jenkins/tools/bom/bom/2.176.1-rc41.149af85f094d/bom-2.176.1-rc41.149af85f094d.pom'
      }
    )
  })
  it('Fails with no permissions error', async function() {
    const folderMetadataParsed = {
      owner: 'jenkinsci',
      repo: 'bom'
    }
    const buildMetadataParsed = {
      hash: '5055257e4d28adea76fc34fdde4e025347405bae'
    }

    const repoPath = path.join(folderMetadataParsed.owner, folderMetadataParsed.repo);
    const entries = [];
    let perms = {
      status: 200,
      json: () => require('./fixtures-permissions-missing-path.json')
    }
    assert.rejects(
      () =>  Permissions.verify(
        { info: () => true },
        repoPath,
        path.resolve('./test/fixtures-good-archive.zip'),
        entries,
        perms,
        buildMetadataParsed.hash
      ),
      {
        name: 'Error',
        message: 'ZIP error: Error: No permissions for io/jenkins/tools/bom/bom-2.222.x/29-rc793.5055257e4d28/bom-2.222.x-29-rc793.5055257e4d28.pom'
      }
    )
  })
  it('Succeeds with good pom', async function() {
    const folderMetadataParsed = {
      owner: 'jenkinsci',
      repo: 'bom'
    }
    const buildMetadataParsed = {
      hash: '5055257e4d28adea76fc34fdde4e025347405bae'
    }

    const repoPath = path.join(folderMetadataParsed.owner, folderMetadataParsed.repo);
    const entries = [];
    let perms = {
      status: 200,
      json: () => require('./fixtures-permissions.json')
    };
    const response = await Permissions.verify(
      { info: () => true },
      repoPath,
      path.resolve('./test/fixtures-good-archive.zip'),
      entries,
      perms,
      buildMetadataParsed.hash
    );
    assert.equal(response, true)
  })
  it('Succeeds with wildcard path', async function() {
    const folderMetadataParsed = {
      owner: 'jenkinsci',
      repo: 'bom'
    }
    const buildMetadataParsed = {
      hash: '5055257e4d28adea76fc34fdde4e025347405bae'
    }

    const repoPath = path.join(folderMetadataParsed.owner, folderMetadataParsed.repo);
    const entries = [];
    let perms = {
      status: 200,
      json: () => require('./fixtures-permissions-wildcard.json')
    };
    const response = await Permissions.verify(
      { info: () => true },
      repoPath,
      path.resolve('./test/fixtures-good-archive.zip'),
      entries,
      perms,
      buildMetadataParsed.hash
    );
    assert.equal(response, true)
  })
});
