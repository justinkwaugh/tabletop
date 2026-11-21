import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { RailwayMapState, TileEdges, rotateTileEdge, type MapLocation } from '@tabletop/18xx'
import {
    BridgeCityIds,
    ClevelandId,
    GreatNorthernBorderIds,
    MetropolisCandidates,
    MexicoLocationIds,
    NewYorkId,
    RedAreas,
    RequiredTileEdges,
    ResourceKinds,
    ResourceLocationIds,
    SmallCityIds,
    SubsidyCityIds,
    assignRedAreaTokens,
    EighteenUSAMap,
    EighteenUSATileSet,
    dealtRedAreaRevenues,
    redAreaToken,
    resourcesAt
} from './index.js'

const assignment = assignRedAreaTokens(new Prng({ seed: 18, invocations: 0 }))
const map = EighteenUSAMap
const location = (id: string) => map.location(id)
const printedEdges = (place: MapLocation) =>
    place.preprintedTile.paths.flatMap((path) =>
        path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
    )
const cityNodes = (id: string) =>
    location(id).preprintedTile.nodes.filter((node) => node.kind === 'city')

describe('the 18USA map', () => {
    it('draws 114 pointy hexes', () => {
        expect(map.definition.locations).toHaveLength(114)
        const byColor = (color: string) =>
            map.definition.locations.filter((place) => place.preprintedTile.color === color).length
        expect([
            byColor('white'),
            byColor('gray'),
            byColor('yellow'),
            byColor('blue'),
            byColor('red')
        ]).toEqual([95, 3, 1, 3, 12])
    })

    it('places neighbors around pointy hexes', () => {
        expect(TileEdges.map((edge) => map.neighbor('D20', edge)?.id)).toEqual([
            'E19',
            'D18',
            'C19',
            'C21',
            'D22',
            'E21'
        ])
    })

    it('points every printed track at a hex that can meet it', () => {
        for (const place of map.definition.locations)
            for (const edge of printedEdges(place)) {
                const neighbor = map.neighbor(place.id, edge)
                expect(neighbor, `${place.id} edge ${edge}`).toBeDefined()
                if (neighbor && !neighbor.buildable)
                    expect(
                        printedEdges(neighbor),
                        `${place.id} edge ${edge} meets ${neighbor.id}`
                    ).toContain(rotateTileEdge(edge, 3))
            }
    })

    it('points the D26 and E27 stubs into New York', () => {
        for (const [id, edge] of Object.entries(RequiredTileEdges)) {
            expect(map.neighbor(id, edge)?.id).toBe(NewYorkId)
            expect(printedEdges(location(NewYorkId))).toContain(rotateTileEdge(edge, 3))
        }
    })

    it('starts New York as two yellow cities worth 40', () => {
        const newYork = location(NewYorkId)
        expect(newYork.preprintedTile.labels).toEqual(['NY'])
        expect(cityNodes(NewYorkId)).toHaveLength(2)
        expect(location(ClevelandId).upgradeLabels).toEqual([{ color: 'brown', label: 'CLE' }])
    })

    it('charges the printed terrain costs', () => {
        const cost = (id: string) => location(id).terrain?.cost
        expect(['F4', 'C9', 'D18', 'C17', 'B22', 'B8', 'D16'].map(cost)).toEqual([
            15,
            15,
            10,
            10,
            20,
            undefined,
            undefined
        ])
    })

    it('names the fourteen subsidy cities of the rulebook', () => {
        expect(SubsidyCityIds.map((id) => location(id).name).sort()).toEqual([
            'Boise',
            'Columbus',
            'Fargo',
            'Helena',
            'Jacksonville',
            'Norfolk',
            'Omaha',
            'Phoenix',
            'Portland',
            'Sacramento',
            'Salt Lake City',
            'San Antonio',
            'Santa Fe',
            'Tucson'
        ])
        for (const id of SubsidyCityIds) expect(cityNodes(id)).toMatchObject([{ stationSlots: 1 }])
    })

    it('puts the metropolis candidates and bridges on cities', () => {
        expect(MetropolisCandidates.map((city) => location(city.locationId).name)).toEqual([
            'Atlanta',
            'Chicago',
            'Dallas-Fort Worth',
            'Denver',
            'Los Angeles',
            'New Orleans'
        ])
        for (const id of BridgeCityIds) {
            expect(cityNodes(id)).toHaveLength(1)
            expect(location(id).terrain).toEqual({ cost: 10, kinds: ['water'] })
            expect(location(id).markers?.map((marker) => marker.id)).toContain('bridge')
        }
    })

    it('makes the small cities always-open cities without station slots', () => {
        expect(SmallCityIds.map((id) => location(id).name)).toEqual([
            'Winnipeg',
            'Seattle',
            'Detroit',
            'Toronto',
            'San Francisco',
            'Florida'
        ])
        for (const id of SmallCityIds) expect(cityNodes(id)).toMatchObject([{ stationSlots: 0 }])
    })

    it('marks resources on open hexes, two of them on B10 and B12', () => {
        expect(ResourceKinds.map((kind) => ResourceLocationIds[kind].length)).toEqual([14, 7, 8])
        expect([resourcesAt('B10'), resourcesAt('B12')]).toEqual([
            ['coal', 'ore'],
            ['coal', 'oil']
        ])
        for (const kind of ResourceKinds)
            for (const id of ResourceLocationIds[kind]) {
                expect(location(id).preprintedTile.nodes, id).toEqual([])
                expect(location(id).markers?.map((marker) => marker.id)).toContain(kind)
            }
    })

    it('marks the northern border for the Great Northern', () => {
        for (const id of GreatNorthernBorderIds) {
            expect(id.startsWith('B')).toBe(true)
            expect(location(id).markers?.some((marker) => marker.id === 'great-northern')).toBe(
                true
            )
        }
    })

    it('values each red area from its dealt token', () => {
        const inventory = {
            ...EighteenUSATileSet.createInventory(),
            dealtRevenues: dealtRedAreaRevenues(assignment)
        }
        const board = new RailwayMapState(map, EighteenUSATileSet, inventory)
        for (const area of RedAreas) {
            const values = redAreaToken(assignment[area.id]).values
            for (const id of area.locationIds) {
                const place = location(id)
                expect(place.preprintedTile.color).toBe('red')
                const [stop] = board.tile(id).face.nodes
                expect(stop.kind).toBe(area.routeEnd ? 'offboard' : 'city')
                expect(stop.kind !== 'junction' && stop.revenue).toEqual({
                    kind: 'staged',
                    values: ['yellow', 'green', 'brown', 'gray'].map((stage, index) => ({
                        stage,
                        amount: values[index]
                    }))
                })
            }
        }
    })

    it('groups the Mexico hexes into one stop', () => {
        expect(MexicoLocationIds.map((id) => location(id).stopGroup)).toEqual(
            MexicoLocationIds.map(() => 'mexico')
        )
        expect(map.definition.locations.filter((place) => place.stopGroup)).toHaveLength(6)
    })
})
