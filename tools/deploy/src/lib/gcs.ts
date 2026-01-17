import fs from 'node:fs'
import path from 'node:path'
import { SiteManifest } from './types.js'

export type GcsStatus = {
    frontendExists: boolean
    games: Record<string, boolean>
}

const pathExists = (target: string) => {
    try {
        return fs.existsSync(target)
    } catch {
        return false
    }
}

export const checkGcsStatus = (manifest: SiteManifest, gcsRoot: string): GcsStatus => {
    const frontendPath = path.join(gcsRoot, 'frontend', manifest.frontend.version)
    const games: Record<string, boolean> = {}

    for (const [gameId, entry] of Object.entries(manifest.games)) {
        const uiPath = path.join(gcsRoot, 'games', gameId, entry.uiVersion)
        games[gameId] = pathExists(uiPath)
    }

    return {
        frontendExists: pathExists(frontendPath),
        games
    }
}
