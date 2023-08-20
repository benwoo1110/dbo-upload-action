const core = require('@actions/core');
const github = require('@actions/github');
const FormData = require('form-data');
const fs = require('fs');

try {
  const dboToken = core.getInput('dbo_token', { required: true });
  const projectId = core.getInput('project_id', { required: true });
  const changelog = core.getInput('changelog', { required: true });
  const changelogType = core.getInput('changelog_type');
  const displayName = core.getInput('display_name');
  const parentFileID = core.getInput('parent_file_id');
  const gameVersions = core.getInput('game_versions');
  const releaseType = core.getInput('release_type');
  const projectRelations = core.getInput('project_relations');
  const filePath = core.getInput('file_path', { required: true });
  const debug = core.getBooleanInput('debug');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('metadata', {
    changelog,
    changelogType,
    displayName,
    parentFileID,
    releaseType,
    gameVersions: gameVersions.split(','),
    relations: {
      projects: JSON.parse(projectRelations)
    }
  });
  fetch(`https://dev.bukkit.org/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: {
      'User-Agent': 'dbo-action',
      'X-Api-Token': dboToken,
      ...form.getHeaders()
    },
    body: form
  })
  .then(res => {
    if (!res.ok) {
      if (debug) {
        console.log(res);
      }
      throw new Error(`Received status code ${res.status}`);
    }
    return res.json();
  })
  .then(json => {
    core.setOutput('success', json)
  })
} catch (error) {
  core.setFailed(error.message);
}
