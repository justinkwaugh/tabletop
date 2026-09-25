import { isObject } from './json.js'
import fs from 'node:fs/promises'
import { GameCatalogueEntry, SiteManifest } from './types.js'

export const parseManifest = (raw: string): SiteManifest => {
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

    if (
        'history' in frontend &&
        frontend.history !== undefined &&
        !Array.isArray(frontend.history)
    ) {
        throw new Error('Manifest frontend.history must be an array')
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
        if ('history' in entry && entry.history !== undefined && !Array.isArray(entry.history)) {
            throw new Error(`Manifest ${entry.gameId}.history must be an array`)
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

export const readCatalogue = async (cataloguePath: string): Promise<GameCatalogueEntry[]> => {
    const parsed = JSON.parse(await fs.readFile(cataloguePath, 'utf8')) as unknown
    if (!Array.isArray(parsed)) {
        throw new Error('Game catalogue must be an array')
    }
    for (const entry of parsed) {
        if (
            !isObject(entry) ||
            typeof entry.gameId !== 'string' ||
            typeof entry.packageId !== 'string'
        ) {
            throw new Error('Game catalogue entries need gameId and packageId strings')
        }
    }
    return parsed as GameCatalogueEntry[]
}
