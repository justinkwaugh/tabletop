import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { GameCatalogEntry } from '@tabletop/common'
import type { SiteManifest } from '@tabletop/games-config'
import * as Value from 'typebox/value'

type Publication = SiteManifest['games'][number]

export class CatalogService {
    private readonly entries = new Map<string, Promise<GameCatalogEntry>>()

    private catalog?: { key: string; entries: Promise<GameCatalogEntry[]> }

    constructor(private readonly gamesRoot: string) {}

    async getCatalog(manifest: SiteManifest): Promise<GameCatalogEntry[]> {
        const key = JSON.stringify(manifest.games.map((game) => this.entryKey(game)))
        if (this.catalog?.key === key) return this.catalog.entries
        const entries = this.loadCatalog(manifest)
        this.catalog = { key, entries }
        const catalog = await entries
        if (catalog.length !== manifest.games.length && this.catalog?.entries === entries) {
            this.catalog = undefined
        }
        return catalog
    }

    private async loadCatalog(manifest: SiteManifest): Promise<GameCatalogEntry[]> {
        const currentKeys = new Set(manifest.games.map((game) => this.entryKey(game)))
        for (const key of this.entries.keys()) {
            if (!currentKeys.has(key)) this.entries.delete(key)
        }

        const results = await Promise.allSettled(manifest.games.map((game) => this.getEntry(game)))
        return results.flatMap((result, index) => {
            if (result.status === 'fulfilled') return [result.value]
            console.warn(`Catalog unavailable for ${manifest.games[index].gameId}`, result.reason)
            return []
        })
    }

    private getEntry(game: Publication): Promise<GameCatalogEntry> {
        const key = this.entryKey(game)
        let entry = this.entries.get(key)
        if (!entry) {
            entry = this.readEntry(this.catalogPath(game), game.gameId).catch((error: unknown) => {
                this.entries.delete(key)
                throw error
            })
            this.entries.set(key, entry)
        }
        return entry
    }

    private async readEntry(catalogPath: string, gameId: string): Promise<GameCatalogEntry> {
        const entry: unknown = JSON.parse(await readFile(catalogPath, 'utf8'))
        if (!Value.Check(GameCatalogEntry, entry)) {
            throw new Error(`Invalid catalog entry for ${gameId}`)
        }
        if (entry.id !== gameId) {
            throw new Error(`Catalog identity mismatch for ${gameId}`)
        }
        return entry
    }

    private entryKey(game: Publication): string {
        return JSON.stringify([game.gameId, this.catalogPath(game)])
    }

    private catalogPath(game: Publication): string {
        return path.join(this.gamesRoot, game.packageId, 'ui', game.uiVersion, 'catalog.json')
    }
}
