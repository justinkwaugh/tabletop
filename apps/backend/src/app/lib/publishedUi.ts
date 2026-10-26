import type { GameClientCapability } from '@tabletop/common'
import type { CatalogService, LibraryService } from '@tabletop/backend-services'

/** Whether the UI Artifact a title currently publishes declares the capability. */
export async function publishedUiSupports(
    services: {
        libraryService: Pick<LibraryService, 'getGeneration'>
        catalogService: Pick<CatalogService, 'supportsCapability'>
    },
    titleId: string,
    capability: GameClientCapability
): Promise<boolean> {
    const publication = services.libraryService.getGeneration(titleId)?.publication
    return (
        publication !== undefined &&
        (await services.catalogService.supportsCapability(publication, capability))
    )
}
