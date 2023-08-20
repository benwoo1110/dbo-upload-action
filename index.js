import core from '@actions/core';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';

const apiToken = core.getInput('api_token', { required: true });
const projectId = core.getInput('project_id', { required: true });
const changelog = core.getInput('changelog');
const changelogType = core.getInput('changelog_type');
const displayName = core.getInput('display_name');
const parentFileID = core.getInput('parent_file_id');
const gameVersions = core.getInput('game_versions');
const releaseType = core.getInput('release_type');
const projectRelations = core.getInput('project_relations');
const filePath = core.getInput('file_path', { required: true });
const debug = core.getBooleanInput('debug');

try {
  console.log(`Uploading ${filePath} to project ${projectId}...`);
  const metadata = parseMetadata();
  if (debug) {
    console.log(JSON.stringify(metadata, null, 2));
  }
  await uploadFile(metadata);
} catch (error) {
  core.setFailed(error.message);
}

function parseMetadata() {
  if (!parentFileID && !gameVersions) {
    core.setFailed('You must specify either parent_file_id or game_versions');
    process.exit(1);
  }
  if (parentFileID && gameVersions) {
    core.setFailed('You cannot specify both parent_file_id and game_versions');
    process.exit(1);
  }

  const metadata = {
    changelog,
    changelogType,
    displayName,
    parentFileID,
    gameVersions: gameVersions.split(' ').map(Number),
    releaseType,
    relations: {
      projects: JSON.parse(projectRelations)
    }
  };

  // remove undefined values
  Object.keys(metadata).forEach(key => metadata[key] === '' && delete metadata[key]);

  return metadata;
}

async function uploadFile(metadata) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('metadata', JSON.stringify(metadata));

  await fetch(`https://dev.bukkit.org/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: {
      'User-Agent': 'dbo-action',
      'X-Api-Token': apiToken,
      ...form.getHeaders()
    },
    body: form
  })
    .then(async res => {
      if (debug) {
        console.log(res);
        console.log(await res.text());
      }
      if (!res.ok) {
        core.setFailed(`Request failed with status code ${res.status}`);
      }
    })
}
