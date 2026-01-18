import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { DeployConfig, SiteManifest } from './types.js'

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

const gcsPathExists = (target: string): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn('gcloud', ['storage', 'ls', target], {
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
    gameId: string,
    config: DeployConfig,
    gcsRoot: string
): Promise<boolean> => {
    const entry = manifest.games[gameId]
    if (!entry) return false
    const bucket = config.gcsBucket
    if (bucket) {
        const uiPath = `gs://${bucket}/games/${gameId}/${entry.uiVersion}/index.js`
        return gcsPathExists(uiPath)
    }

    const uiPath = path.join(gcsRoot, 'games', gameId, entry.uiVersion, 'index.js')
    return pathExists(uiPath)
}
