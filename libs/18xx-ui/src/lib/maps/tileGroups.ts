import type { MapViewDefinition } from './stationPresentation.js'

type TileGroups = Pick<MapViewDefinition, 'tileGroups'>

/** The hexes one tile covers with this hex, if the view groups it. */
export function tileGroupOf(view: TileGroups, locationId: string): readonly string[] | undefined {
    return view.tileGroups?.find((group) => group.includes(locationId))
}

/** These hexes, and every hex a tile covers together with any of them. */
export function withTileGroups(view: TileGroups, locationIds: readonly string[]): string[] {
    return [
        ...new Set(
            locationIds.flatMap((locationId) => tileGroupOf(view, locationId) ?? [locationId])
        )
    ]
}
