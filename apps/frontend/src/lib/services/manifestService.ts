import { TabletopApi, type GameVersionProvider } from '@tabletop/frontend-components'
import type { SiteManifest, SiteManifestGame } from '@tabletop/games-config'

export type ManifestResponse = SiteManifest & {
    backend?: {
        version?: string | null
        buildSha?: string | null
        buildTime?: string | null
        revision?: string | null
    }
}

export type ManifestGame = SiteManifestGame

export class ManifestService implements GameVersionProvider {
    private manifest: ManifestResponse | null = null
    private readonly gamesById = new Map<string, ManifestGame>()
    private readonly loadPromise: Promise<ManifestResponse>

    constructor(private readonly api: TabletopApi) {
        this.loadPromise = this.load()
        this.loadPromise.catch(() => undefined)
    }

    async whenReady(): Promise<ManifestResponse> {
        return this.loadPromise
    }

    getManifestSnapshot(): ManifestResponse | null {
        return this.manifest
    }

    getFrontendVersion(): string | undefined {
        return this.manifest?.frontend.version
    }

    getLogicVersion(gameId: string): string | undefined {
        return this.gamesById.get(gameId)?.logicVersion
    }

    getUiVersion(gameId: string): string | undefined {
        return this.gamesById.get(gameId)?.uiVersion
    }

    private async load(): Promise<ManifestResponse> {
        const manifest = await this.api.manifest<ManifestResponse>()
        this.applyManifest(manifest)
        return manifest
    }

    private applyManifest(manifest: ManifestResponse) {
        this.manifest = manifest
        this.gamesById.clear()
        for (const game of manifest.games) {
            this.gamesById.set(game.gameId, game)
        }
    }
}
