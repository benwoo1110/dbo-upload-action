import core from '@actions/core'
import FormData from 'form-data'
import fetch from 'node-fetch'
import fs from 'fs'

interface Metadata {
  changelog: string
  changelogType: string
  displayName: string
  parentFileID: string
  gameVersions: number[]
  releaseType: string
  relations: {
    projects: {
      id: number
      slug: string
    }[]
  }
}

interface Version {
  id: number
  gameVersionTypeID: number
  name: string
  slug: string
  apiVersion: string | null
}

interface Output {
  id: number
}

const apiToken = core.getInput('api_token', { required: true })
const projectId = core.getInput('project_id', { required: true })
const changelog = core.getInput('changelog')
const changelogType = core.getInput('changelog_type')
const displayName = core.getInput('display_name')
const parentFileID = core.getInput('parent_file_id')
const gameVersions = core.getInput('game_versions')
const releaseType = core.getInput('release_type')
const projectRelations = core.getInput('project_relations')
const filePath = core.getInput('file_path', { required: true })
const debug = core.getBooleanInput('debug')

main().catch(err => {
  console.error(err)
  core.setFailed(err.message)
})

async function main() {
  console.log(`Uploading ${filePath} to project ${projectId}...`)
  const metadata: Metadata = await parseMetadata()
  if (debug) {
    console.log(JSON.stringify(metadata, null, 2))
  }
  await uploadFile(metadata)
}

async function parseMetadata(): Promise<Metadata> {
  if (!parentFileID && !gameVersions) {
    core.setFailed('You must specify either parent_file_id or game_versions')
    process.exit(1)
  }
  if (parentFileID && gameVersions) {
    core.setFailed('You cannot specify both parent_file_id and game_versions')
    process.exit(1)
  }

  const metadata: Metadata = {
    changelog,
    changelogType: changelogType.toLowerCase(),
    displayName,
    parentFileID,
    gameVersions: await gameVersionsToIds(),
    releaseType: releaseType.toLowerCase(),
    relations: {
      projects: JSON.parse(projectRelations)
    }
  }

  return metadata
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
        console.log(res)
        console.log(await res.text())
      }
      core.setFailed(`Request failed with status code ${res.status}`)
      process.exit(1)
    }
    return await res.json()
  }) as Version[]

  const idsMap: { [key: string]: number } = {}
  availableVersions.forEach(version => {
    if (version.gameVersionTypeID === 1) {
      idsMap[version.name] = version.id
    }
  })

  const parsedGameVersions: number[] = []
  gameVersions.split(', ').forEach(version => {
    const id = idsMap[version]
    if (!id) {
      console.log(`ERROR: Invalid game version ${version}`)
      return
    }
    parsedGameVersions.push(id)
  })

  return parsedGameVersions
}

async function uploadFile(metadata: Metadata) {
  // Remove '' from metadata
  const metadataCleaned: { [key: string]: unknown } = {}
  Object.keys(metadata).forEach(key => {
    const value = metadata[key as keyof typeof metadata]
    if (value !== '') {
      metadataCleaned[key] = value
    }
  })

  const form = new FormData()
  form.append('file', fs.createReadStream(filePath))
  form.append('metadata', JSON.stringify(metadataCleaned))

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
        console.log(res)
        console.log(await res.text())
      }
      core.setFailed(`Request failed with status code ${res.status}`)
      process.exit(1)
    }
    return await res.json() as Output
  }).then(json => {
    if (debug) {
      console.log(json)
    }
    core.setOutput('file_id', json.id)
  })
}
