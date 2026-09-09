import type { TileDefinition, TileRevenue } from '@tabletop/18xx'

export const TileColors: Readonly<Record<string, string>> = Object.freeze({
    white: '#f4efe4',
    yellow: '#ffdf00',
    green: '#5ab67e',
    brown: '#bd865e',
    gray: '#b9bdc0',
    red: '#e49b91',
    blue: '#9fc5da',
    black: '#a1a4a6',
    pink: '#edb9d0',
    purple: '#c7b1df',
    orange: '#eab076',
    navy: '#a3b3d3'
})

export type TileLibraryFilter = {
    search: string
    color: string
    track: 'all' | 'edge' | 'node'
    stop: 'all' | 'city' | 'town' | 'offboard' | 'junction'
}

export function filterTileDefinitions(
    tiles: readonly TileDefinition[],
    filter: TileLibraryFilter
): readonly TileDefinition[] {
    const query = filter.search.trim().toLocaleLowerCase()
    return tiles.filter((tile) => {
        const searchable = [
            tile.id,
            tile.printedNumber,
            tile.scope,
            ...tile.aliases,
            ...tile.face.labels
        ]
            .join(' ')
            .toLocaleLowerCase()
        return (
            (!query || searchable.includes(query)) &&
            (!filter.color || tile.face.color === filter.color) &&
            (filter.track === 'all' ||
                tile.face.paths.some((path) =>
                    filter.track === 'edge'
                        ? path.endpoints.every((endpoint) => endpoint.kind === 'edge')
                        : path.endpoints.some((endpoint) => endpoint.kind === 'node')
                )) &&
            (filter.stop === 'all' || tile.face.nodes.some((node) => node.kind === filter.stop))
        )
    })
}

export function tileRevenueText(revenue: TileRevenue): string {
    return revenue.kind === 'fixed'
        ? String(revenue.amount)
        : revenue.values.map((value) => `${value.stage}: ${value.amount}`).join(' / ')
}
