import core from '@actions/core';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import { stringify } from 'querystring';

try {
  const apiToken = core.getInput('api_token', { required: true });
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

  const metadata = {
    changelog,
    changelogType,
    displayName,
    // parentFileID,
    releaseType,
    gameVersions: gameVersions.split(' ').map(Number),
    relations: {
      projects: JSON.parse(projectRelations)
    }
  };

  if (debug) {
    core.info(`Uploading ${filePath} to project ${projectId}...`);
    core.info(JSON.stringify(metadata));
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('metadata', JSON.stringify(metadata));
  
  fetch(`https://dev.bukkit.org/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: {
      'User-Agent': 'dbo-action',
      'X-Api-Token': apiToken,
      ...form.getHeaders()
    },
    body: form
  })
  .then(res => {
    if (!res.ok) {
      if (debug) {
        console.log(res);
        core.info(JSON.stringify(res.json()));
      }
      core.setFailed(`Request failed with status code ${res.status}`);
      return;
    }
    core.setOutput('success', res.json())
  })
} catch (error) {
  core.setFailed(error.message);
}
