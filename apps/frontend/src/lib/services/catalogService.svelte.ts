import type { GameCatalogEntry } from '@tabletop/common'
import type { TabletopApi } from '@tabletop/frontend-components'

export class CatalogService {
    entries: GameCatalogEntry[] = $state([])
    loading = $state(true)
    private loadPromise?: Promise<void>

    constructor(private readonly api: TabletopApi) {}

    whenReady(): Promise<void> {
        return (this.loadPromise ??= this.load())
    }

    private async load(): Promise<void> {
        try {
            this.entries = await this.api.getGameCatalog()
        } catch (error) {
            console.error('Could not load the game catalog', error)
        } finally {
            this.loading = false
        }
    }
}
