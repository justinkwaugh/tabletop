import path from 'node:path'
import { readFile } from 'node:fs/promises'
import type { GameCatalogEntry } from '@tabletop/common'
import type { SiteManifest } from '@tabletop/games-config'

type Publication = SiteManifest['games'][number]

export class CatalogService {
    private readonly entries = new Map<string, Promise<GameCatalogEntry>>()

    private catalog?: { key: string; entries: Promise<GameCatalogEntry[]> }

    constructor(private readonly gamesRoot: string) {}

    async getCatalog(manifest: SiteManifest): Promise<GameCatalogEntry[]> {
        const key = JSON.stringify(
            manifest.games.map((game) => [game.gameId, this.catalogPath(game)])
        )
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
        const currentPaths = new Set(manifest.games.map((game) => this.catalogPath(game)))
        for (const key of this.entries.keys()) {
            if (!currentPaths.has(key)) this.entries.delete(key)
        }

        const results = await Promise.allSettled(
            manifest.games.map(async (game) => {
                const entry = await this.getEntry(game)
                if (entry.id !== game.gameId) {
                    throw new Error(`Catalog identity mismatch for ${game.packageId}`)
                }
                return entry
            })
        )
        return results.flatMap((result, index) => {
            if (result.status === 'fulfilled') return [result.value]
            console.warn(`Catalog unavailable for ${manifest.games[index].gameId}`, result.reason)
            return []
        })
    }

    private getEntry(game: Publication): Promise<GameCatalogEntry> {
        const catalogPath = this.catalogPath(game)
        let entry = this.entries.get(catalogPath)
        if (!entry) {
            entry = this.readEntry(catalogPath).catch((error: unknown) => {
                this.entries.delete(catalogPath)
                throw error
            })
            this.entries.set(catalogPath, entry)
        }
        return entry
    }

    private async readEntry(catalogPath: string): Promise<GameCatalogEntry> {
        return JSON.parse(await readFile(catalogPath, 'utf8'))
    }

    private catalogPath(game: Publication): string {
        return path.join(this.gamesRoot, game.packageId, 'ui', game.uiVersion, 'catalog.json')
    }
}
