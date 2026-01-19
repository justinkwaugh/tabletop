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
    if (
        'priorVersions' in frontend &&
        frontend.priorVersions !== undefined &&
        (!Array.isArray(frontend.priorVersions) ||
            frontend.priorVersions.some((value) => typeof value !== 'string'))
    ) {
        throw new Error('Manifest frontend.priorVersions must be a string array')
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
        if (
            'priorLogicVersions' in entry &&
            entry.priorLogicVersions !== undefined &&
            (!Array.isArray(entry.priorLogicVersions) ||
                entry.priorLogicVersions.some((value) => typeof value !== 'string'))
        ) {
            throw new Error(`Manifest ${entry.gameId}.priorLogicVersions must be a string array`)
        }
        if (
            'priorUiVersions' in entry &&
            entry.priorUiVersions !== undefined &&
            (!Array.isArray(entry.priorUiVersions) ||
                entry.priorUiVersions.some((value) => typeof value !== 'string'))
        ) {
            throw new Error(`Manifest ${entry.gameId}.priorUiVersions must be a string array`)
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
