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
    if (!Array.isArray(games)) {
        throw new Error('Manifest games must be an array')
    }

    for (const entry of games) {
        if (!isObject(entry)) {
            throw new Error('Manifest game entry must be an object')
        }
        if (typeof entry.gameId !== 'string') {
            throw new Error('Manifest game entry gameId must be a string')
        }
        if (typeof entry.packageId !== 'string') {
            throw new Error(`Manifest game entry ${entry.gameId} packageId must be a string`)
        }
        if (typeof entry.logicVersion !== 'string') {
            throw new Error(`Manifest ${entry.gameId}.logicVersion must be a string`)
        }
        if (typeof entry.uiVersion !== 'string') {
            throw new Error(`Manifest ${entry.gameId}.uiVersion must be a string`)
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
