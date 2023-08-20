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
  const metadata = await parseMetadata();
  if (debug) {
    console.log(JSON.stringify(metadata, null, 2));
  }
  await uploadFile(metadata);
} catch (error) {
  core.setFailed(error.message);
}

async function parseMetadata() {
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
    gameVersions: await gameVersionsToIds(),
    releaseType,
    relations: {
      projects: JSON.parse(projectRelations)
    }
  };

  // remove undefined values
  Object.keys(metadata).forEach(key => metadata[key] === '' && delete metadata[key]);

  return metadata;
}

async function gameVersionsToIds() {
  const availableVersions = await fetch('https://dev.bukkit.org/api/game/versions', {
    method: 'GET',
    headers: {
      'User-Agent': 'dbo-upload-action',
      'X-Api-Token': apiToken,
    }
  }).then(async res => {
    if (!res.ok) {
      if (debug) {
        console.log(res);
        console.log(await res.text());
      }
      core.setFailed(`Request failed with status code ${res.status}`);
      process.exit(1);
    }
    return await res.json();
  })

  const idsMap = {};
  availableVersions.forEach(version => {
    idsMap[version.name] = version.id;
  });

  const parsedGameVersions = [];
  gameVersions.split(', ').forEach(version => {
    const id = idsMap[version];
    if (!id) {
      core.setFailed(`Invalid game version ${version}`);
      process.exit(1);
    }
    parsedGameVersions.push(id);
  })

  return parsedGameVersions;
}

async function uploadFile(metadata) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('metadata', JSON.stringify(metadata));

  await fetch(`https://dev.bukkit.org/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: {
      'User-Agent': 'dbo-upload-action',
      'X-Api-Token': apiToken,
      ...form.getHeaders()
    },
    body: form
  }).then(async res => {
    if (!res.ok) {
      if (debug) {
        console.log(res);
        console.log(await res.text());
      }
      core.setFailed(`Request failed with status code ${res.status}`);
      process.exit(1);
    }
    return await res.json();
  }).then(json => {
    if (debug) {
      console.log(json);
    }
    core.setOutput('file_id', json.id);
  })
}
