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

export function compareTileSimplicity(a: TileDefinition, b: TileDefinition): number {
    const citiesA = a.face.nodes.filter((node) => node.kind === 'city')
    const citiesB = b.face.nodes.filter((node) => node.kind === 'city')
    return (
        Number(citiesA.length > 0) - Number(citiesB.length > 0) ||
        a.face.nodes.length - b.face.nodes.length ||
        a.face.paths.length - b.face.paths.length ||
        citiesA.reduce((sum, city) => sum + city.stationSlots, 0) -
            citiesB.reduce((sum, city) => sum + city.stationSlots, 0) ||
        tileTrackBend(a) - tileTrackBend(b) ||
        a.printedNumber.localeCompare(b.printedNumber, undefined, { numeric: true })
    )
}

function tileTrackBend(tile: TileDefinition): number {
    return tile.face.paths.reduce((sum, path) => {
        const [a, b] = path.endpoints
        if (a.kind !== 'edge' || b.kind !== 'edge') return sum
        const distance = Math.abs(a.edge - b.edge)
        return sum + 3 - Math.min(distance, 6 - distance)
    }, 0)
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
