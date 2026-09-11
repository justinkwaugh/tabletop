import type { TilePath } from '../tiles/tile.js'

export function routePathResources(locationId: string, path: TilePath): string[] {
    return [
        JSON.stringify([locationId, 'path', path.id]),
        ...path.endpoints.flatMap((end) =>
            end.kind === 'edge' ? [JSON.stringify([locationId, 'edge', end.edge])] : []
        )
    ]
}
