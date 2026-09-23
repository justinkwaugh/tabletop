import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { DeployConfig, SiteManifest } from './types.js'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'

export type GcsStatus = {
    frontendExists: boolean | null
    games: Record<string, boolean | null>
}

const pathExists = (target: string) => {
    try {
        return fs.existsSync(target)
    } catch {
        return false
    }
}

export const gcsPathExists = (target: string): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn('gcloud', ['storage', 'ls', target], {
            env: withCloudSdkPythonEnv(process.env),
            stdio: ['ignore', 'pipe', 'pipe']
        })
        let hasOutput = false

        child.stdout.on('data', (chunk) => {
            if (chunk.toString().trim()) {
                hasOutput = true
            }
        })

        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0 && hasOutput))
    })

export const artifactImageExists = (image: string, project: string): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn(
            'gcloud',
            ['artifacts', 'docker', 'images', 'describe', image, '--project', project, '--quiet'],
            { env: withCloudSdkPythonEnv(process.env), stdio: ['ignore', 'ignore', 'ignore'] }
        )
        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0))
    })

export const cloudRunRevisionExists = (
    revision: string,
    project: string,
    region: string
): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn(
            'gcloud',
            [
                'run',
                'revisions',
                'describe',
                revision,
                '--project',
                project,
                '--region',
                region,
                '--quiet'
            ],
            { env: withCloudSdkPythonEnv(process.env), stdio: ['ignore', 'ignore', 'ignore'] }
        )
        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0))
    })

export const checkFrontendDeployed = async (
    manifest: SiteManifest,
    config: DeployConfig,
    gcsRoot: string
): Promise<boolean> => {
    const bucket = config.gcsBucket
    if (bucket) {
        const frontendPath = `gs://${bucket}/frontend/${manifest.frontend.version}/`
        return gcsPathExists(frontendPath)
    }

    const frontendPath = path.join(gcsRoot, 'frontend', manifest.frontend.version)
    return pathExists(frontendPath)
}

export const checkGameDeployed = async (
    manifest: SiteManifest,
    packageId: string,
    config: DeployConfig,
    gcsRoot: string
): Promise<boolean> => {
    const entry = manifest.games.find((game) => game.packageId === packageId)
    if (!entry) return false
    const bucket = config.gcsBucket
    if (bucket) {
        const uiPath = `gs://${bucket}/games/${packageId}/ui/${entry.uiVersion}/index.js`
        return gcsPathExists(uiPath)
    }

    const uiPath = path.join(gcsRoot, 'games', packageId, 'ui', entry.uiVersion, 'index.js')
    return pathExists(uiPath)
}
