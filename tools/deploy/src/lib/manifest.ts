import fs from 'node:fs/promises'
import { SiteManifest } from './types.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

export const readManifest = async (manifestPath: string): Promise<SiteManifest> => {
    const raw = await fs.readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown

    if (!isObject(parsed)) {
        throw new Error('Manifest is not an object')
    }

    const frontend = parsed.frontend
    if (!isObject(frontend) || typeof frontend.version !== 'string') {
        throw new Error('Manifest frontend.version must be a string')
    }

    const games = parsed.games
    if (!isObject(games)) {
        throw new Error('Manifest games must be an object')
    }

    for (const [gameId, entry] of Object.entries(games)) {
        if (!isObject(entry)) {
            throw new Error(`Manifest game entry for ${gameId} must be an object`)
        }
        if (typeof entry.logicVersion !== 'string') {
            throw new Error(`Manifest ${gameId}.logicVersion must be a string`)
        }
        if (typeof entry.uiVersion !== 'string') {
            throw new Error(`Manifest ${gameId}.uiVersion must be a string`)
        }
    }

    return parsed as SiteManifest
}

export const writeManifest = async (
    manifestPath: string,
    manifest: SiteManifest
): Promise<void> => {
    const json = JSON.stringify(manifest, null, 2) + '\n'
    await fs.writeFile(manifestPath, json, 'utf8')
}
