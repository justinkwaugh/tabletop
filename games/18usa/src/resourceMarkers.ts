/** The resource and bridge tokens placed on the map, as location markers (§13). */
export const CoalMarker = 'coal-token'
export const OilMarker = 'oil-token'
export const OreMarker = 'ore-token'
/** An ore token upgraded to $20 by a tile action (§13.3). */
export const RichOreMarker = 'ore-20-token'
export const BridgeMarker = 'bridge-token'

export const ResourceMarkerKinds: readonly string[] = [
    CoalMarker,
    OilMarker,
    OreMarker,
    RichOreMarker
]
export const UnupgradableResourceKinds: readonly string[] = [OreMarker, RichOreMarker]
/** P8 Express Freight's station in a red area, which pays its company's trains there $10 (P8). */
export const ExpressFreightMarker = 'express-freight'
/** P6 Import / Export Hub's token laid over a red area's own (P6). */
export const ImportExportMarker = 'import-export'
