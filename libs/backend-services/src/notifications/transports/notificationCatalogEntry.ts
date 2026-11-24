import { GameCatalogEntry } from '@tabletop/common'
import { CatalogService } from '../../games/catalogService.js'
import { LibraryService } from '../../games/libraryService.js'

/** The served catalog entry for a title, or undefined when it can't be read; a message still goes out without it. */
export async function notificationCatalogEntry(
    libraryService: LibraryService,
    catalogService: CatalogService,
    typeId: string
): Promise<GameCatalogEntry | undefined> {
    try {
        const manifest = await libraryService.getServedManifest()
        const catalog = await catalogService.getCatalog(manifest)
        return catalog.find((entry) => entry.id === typeId)
    } catch (error) {
        console.error('Could not load the game catalog for a notification', error)
        return undefined
    }
}
