import { GameCatalogEntry } from '@tabletop/common'
import { CatalogService } from '../../games/catalogService.js'
import { LibraryService } from '../../games/libraryService.js'

export type NotificationCatalog = {
    library: Pick<LibraryService, 'getServedManifest'>
    catalog: Pick<CatalogService, 'getCatalog'>
}

// A message still goes out without the title when the catalog can't be read.
export async function notificationCatalogEntry(
    { library, catalog }: NotificationCatalog,
    typeId: string
): Promise<GameCatalogEntry | undefined> {
    try {
        const manifest = await library.getServedManifest()
        const entries = await catalog.getCatalog(manifest)
        return entries.find((entry) => entry.id === typeId)
    } catch (error) {
        console.error('Could not load the game catalog for a notification', error)
        return undefined
    }
}
