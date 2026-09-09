import { StandardTileCatalog, type TileDefinition } from '@tabletop/18xx'

export const Shikoku1889TileSpecimens: readonly TileDefinition[] = Object.freeze(
    ['3', '5', '6', '7', '8', '9', '14', '16', '611'].map((number) =>
        StandardTileCatalog.get(`18xx:${number}`)
    )
)
