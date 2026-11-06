import { beforeAll, describe, expect, it } from 'vitest'
import { docSection, docTableRows, readDoc } from '../testing/docs.js'
import {
    Regions,
    RouteMedia,
    Routes,
    Spaces,
    type Route,
    type RouteMedium,
    type Space,
    type SpaceId
} from './board.js'
import { VesselTypes } from './components.js'
import { RegionIds } from './regionTiles.js'
import { Charters } from './writs.js'

let components = ''
let spaceRows: Record<string, string>[] = []
let routeRows: Record<string, string>[] = []
let regionRows: Record<string, string>[] = []
let totals: Record<string, string>[] = []
let mapSpaceRows: Record<string, string>[] = []
let mapRouteRows: Record<string, string>[] = []

beforeAll(async () => {
    components = await readDoc('components.md')
    spaceRows = docTableRows(components, '## Board spaces (22)')
    routeRows = docTableRows(components, '## Connections')
    regionRows = docTableRows(components, '## Regions (6)')
    totals = docTableRows(components, '## Totals')
    const boardMap = await readDoc('board-map.md')
    mapSpaceRows = docTableRows(boardMap, '## Spaces')
    mapRouteRows = docTableRows(boardMap, '## Routes')
})

function shortName(id: SpaceId): string {
    return id.replace('space.', '').replace('.', '-')
}

function spaceNames(spaces: readonly Space[]): string[] {
    return spaces.map((space) => shortName(space.id))
}

function routesOf(medium: RouteMedium): Route[] {
    return Routes.filter((route) => route.medium === medium)
}

function mediaAt(id: SpaceId): RouteMedium[] {
    return RouteMedia.filter((medium) =>
        routesOf(medium).some((route) => route.a === id || route.b === id)
    )
}

/** Region order, then number: the order `components.md` writes a route's endpoints in. */
function regionOrder(id: SpaceId): number {
    const [, region = '', number = ''] = id.split('.')
    return RegionIds.findIndex((other) => other === region) * 100 + Number(number)
}

describe('R-1.2.1 the spaces', () => {
    it('22 spaces, in the rows of components.md, with permanent ids', () => {
        expect(Spaces).toHaveLength(22)
        expect(Spaces.map((space) => space.id)).toEqual(spaceRows.map((row) => row['Id']))
    })

    it('sea 3, island 4, forest 3, desert 5, badlands 5, mountain 2', () => {
        const counts = RegionIds.map(
            (region) => Spaces.filter((space) => space.region === region).length
        )
        expect(counts).toEqual([3, 4, 3, 5, 5, 2])
        expect(totals.find((row) => row['Kind'] === 'Board spaces')?.['Rows above']).toBe('22')
    })

    it('each id names its region, which is the row of components.md', () => {
        for (const space of Spaces) {
            expect(space.id.startsWith(`space.${space.region}.`), space.id).toBe(true)
        }
        expect(Spaces.map((space) => space.region)).toEqual(spaceRows.map((row) => row['Region']))
    })

    it('the letters printed on each space are the row of components.md', () => {
        expect(Spaces.map((space) => space.letters.join(' ') || '-')).toEqual(
            spaceRows.map((row) => row['N/S/E/W letters'])
        )
    })

    it('every region has a space for each of N, S, E and W', () => {
        for (const region of RegionIds) {
            const letters = Spaces.filter((space) => space.region === region).flatMap(
                (space) => space.letters
            )
            expect(letters.toSorted(), region).toEqual(['E', 'N', 'S', 'W'])
        }
    })

    it('six starting spaces, the rows of components.md', () => {
        expect(spaceNames(Spaces.filter((space) => space.startingSpace))).toEqual([
            'forest-2',
            'forest-3',
            'desert-3',
            'desert-4',
            'badlands-1',
            'badlands-4'
        ])
        expect(Spaces.map((space) => (space.startingSpace ? 'yes' : 'no'))).toEqual(
            spaceRows.map((row) => row['Starting space'])
        )
    })
})

describe('R-1.2.1 the regions', () => {
    it('six regions, left to right on the board, in the rows of components.md', () => {
        expect(Regions.map((region) => region.id)).toEqual(regionRows.map((row) => row['Id']))
        expect(Regions.map((region) => region.region)).toEqual(RegionIds)
    })

    it('each holds the spaces of its row', () => {
        expect(Regions.map((region) => spaceNames(region.spaces).join(', '))).toEqual(
            regionRows.map((row) => row['Space names'])
        )
        expect(Regions.map((region) => String(region.spaces.length))).toEqual(
            regionRows.map((row) => row['Spaces'])
        )
    })
})

describe('R-1.2.2 the ports', () => {
    it('a space reached by a ship or submersible route is a port, and no other', () => {
        for (const space of Spaces) {
            const media = mediaAt(space.id)
            expect(space.port, space.id).toBe(
                media.includes('ship') || media.includes('submersible')
            )
        }
    })

    it('twelve ports, as components.md lists them', () => {
        const ports = spaceNames(Spaces.filter((space) => space.port))
        expect(ports).toEqual([
            'sea-1',
            'sea-2',
            'sea-3',
            'island-1',
            'island-2',
            'island-3',
            'forest-1',
            'desert-1',
            'desert-2',
            'badlands-2',
            'badlands-3',
            'mountain-2'
        ])
        expect(docSection(components, '## Connections').join(' ')).toContain(
            `The ports are ${ports.join(', ')}.`
        )
    })
})

describe('R-1.2-H1 the route table', () => {
    it('is the rows of the Connections table of components.md', () => {
        expect(Routes.map((route) => route.id)).toEqual(routeRows.map((row) => row['Id']))
        expect(Routes.map((route) => route.medium)).toEqual(routeRows.map((row) => row['Medium']))
        expect(Routes.map((route) => route.a)).toEqual(routeRows.map((row) => row['From']))
        expect(Routes.map((route) => route.b)).toEqual(routeRows.map((row) => row['To']))
    })

    it.each([
        ['road', 13, 'Routes: roads'],
        ['ship', 8, 'Routes: ship'],
        ['submersible', 9, 'Routes: submersible'],
        ['flying-machine', 8, 'Routes: flying machine'],
        ['ferry', 3, 'Routes: ferry']
    ] as const)('%s has %i routes, as the totals say', (medium, count, kind) => {
        expect(routesOf(medium)).toHaveLength(count)
        expect(totals.find((row) => row['Kind'] === kind)?.['Rows above']).toBe(String(count))
    })

    it('41 routes in all', () => {
        expect(Routes).toHaveLength(41)
    })

    it('every endpoint is a space, and a route joins two different spaces', () => {
        const ids = new Set(Spaces.map((space) => space.id))
        for (const route of Routes) {
            expect(ids.has(route.a), route.id).toBe(true)
            expect(ids.has(route.b), route.id).toBe(true)
            expect(route.a, route.id).not.toBe(route.b)
        }
    })

    it('ids are canonical: the medium, then the endpoints in region order', () => {
        for (const route of Routes) {
            expect(route.id).toBe(
                `route.${route.medium}.${shortName(route.a)}--${shortName(route.b)}`
            )
            expect(regionOrder(route.a), route.id).toBeLessThan(regionOrder(route.b))
        }
    })

    it('each route is undirected and listed once', () => {
        const ids = Routes.map((route) => route.id)
        expect(new Set(ids).size).toBe(ids.length)
        const pairs = Routes.map((route) =>
            [route.medium, ...[route.a, route.b].toSorted()].join(' ')
        )
        expect(new Set(pairs).size).toBe(pairs.length)
    })

    it('R-1.2.2 the three ferries, as read from the board', () => {
        expect(routesOf('ferry').map((route) => route.id)).toEqual([
            'route.ferry.island-1--forest-2',
            'route.ferry.desert-4--desert-5',
            'route.ferry.badlands-4--mountain-2'
        ])
    })

    it('every space has a route', () => {
        for (const space of Spaces) {
            expect(mediaAt(space.id).length, space.id).toBeGreaterThan(0)
        }
    })

    it('sea-1, sea-2, sea-3, badlands-3 and badlands-5 have no road', () => {
        const noRoad = spaceNames(Spaces.filter((space) => !mediaAt(space.id).includes('road')))
        expect(noRoad).toEqual(['sea-1', 'sea-2', 'sea-3', 'badlands-3', 'badlands-5'])
        expect(docSection(components, '## Connections').join(' ')).toContain(
            `Spaces with no road: ${noRoad.join(', ')}`
        )
    })

    it('three spaces are reached by one vehicle and nothing else, the Isolated Kingdom', () => {
        const single = Spaces.filter((space) => {
            const media = mediaAt(space.id)
            return media.length === 1 && !media.includes('road')
        })
        expect(single.map((space) => [shortName(space.id), mediaAt(space.id)[0]])).toEqual([
            ['sea-3', 'submersible'],
            ['badlands-3', 'ship'],
            ['badlands-5', 'flying-machine']
        ])
        const isolated = Charters.find((charter) => charter.id === 'writ.charter.isolated-kingdom')
        expect(isolated?.kind === 'kingdom' ? isolated.spaces : []).toEqual(
            single.map((space) => space.id)
        )
    })

    it('no ship reaches the northern mountain space', () => {
        expect(mediaAt('space.mountain.1')).not.toContain('ship')
    })

    it('no submersible joins island-2 and desert-1; a flying machine does', () => {
        const ids = Routes.map((route) => route.id)
        expect(ids).not.toContain('route.submersible.island-2--desert-1')
        expect(ids).toContain('route.flying-machine.island-2--desert-1')
    })

    it('the three vessels each have routes, named as the vessel types', () => {
        for (const vessel of VesselTypes) {
            expect(RouteMedia).toContain(vessel)
            expect(routesOf(vessel).length, vessel).toBeGreaterThan(0)
        }
    })
})

describe('R-4.4.3 the charters', () => {
    it('every space a charter marks is on the map', () => {
        const ids = new Set(Spaces.map((space) => space.id))
        for (const charter of Charters) {
            if (charter.kind === 'kingdom') {
                for (const space of charter.spaces) {
                    expect(ids.has(space), `${charter.id} ${space}`).toBe(true)
                }
            }
        }
    })
})

describe('R-1.2-H1 board-map.md', () => {
    it('lists every space with its region, letters, starting mark and port flag', () => {
        expect(
            Spaces.map((space) => [
                space.id,
                space.region,
                space.letters.join(' ') || '-',
                space.startingSpace ? 'yes' : 'no',
                space.port ? 'yes' : 'no'
            ])
        ).toEqual(
            mapSpaceRows.map((row) => [
                row['Id'],
                row['Region'],
                row['Letters'],
                row['Starting space'],
                row['Port']
            ])
        )
    })

    it('lists every route once', () => {
        expect(Routes.map((route) => [route.id, route.medium, route.a, route.b])).toEqual(
            mapRouteRows.map((row) => [row['Id'], row['Medium'], row['From'], row['To']])
        )
    })

    it('gives each route the confidence of its row in components.md, all of them read', () => {
        expect(mapRouteRows.map((row) => row['Confidence'])).toEqual(
            routeRows.map((row) => row['Confidence'])
        )
        for (const row of mapRouteRows) {
            expect(row['Confidence'], row['Id']).toMatch(/^\[read\] /)
        }
    })
})
