import { TabletopApi, type GameVersionProvider } from '@tabletop/frontend-components'
import { SiteManifest } from '@tabletop/games-config'

export type ManifestResponse = typeof SiteManifest & {
    backend?: {
        buildSha?: string | null
        buildTime?: string | null
        revision?: string | null
    }
}

type ManifestGame = (typeof SiteManifest)['games'][number]

export class ManifestService implements GameVersionProvider {
    private manifest: ManifestResponse | null = null
    private readonly gamesById = new Map<string, ManifestGame>()
    private readonly loadPromise: Promise<ManifestResponse>

    constructor(private readonly api: TabletopApi) {
        this.loadPromise = this.load()
    }

    async whenReady(): Promise<ManifestResponse> {
        return this.loadPromise
    }

    getManifestSnapshot(): ManifestResponse | null {
        return this.manifest
    }

    getLogicVersion(gameId: string): string | undefined {
        return this.gamesById.get(gameId)?.logicVersion
    }

    getUiVersion(gameId: string): string | undefined {
        return this.gamesById.get(gameId)?.uiVersion
    }

    private async load(): Promise<ManifestResponse> {
        if (typeof window === 'undefined') {
            this.applyManifest(SiteManifest)
            return SiteManifest
        }

        try {
            const manifest = await this.api.manifest<ManifestResponse>()
            this.applyManifest(manifest)
            return manifest
        } catch (error) {
            console.error('Failed to load manifest. Falling back to local manifest.', error)
            this.applyManifest(SiteManifest)
            return SiteManifest
        }
    }

    private applyManifest(manifest: ManifestResponse) {
        this.manifest = manifest
        this.gamesById.clear()
        for (const game of manifest.games) {
            this.gamesById.set(game.gameId, game)
        }
    }
}
