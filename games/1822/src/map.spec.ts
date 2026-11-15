import { describe, expect, it } from 'vitest'
import {
    RailwayMapState,
    RouteNetwork,
    routeRevenue,
    rotateTileEdge,
    sameTileEndpoint,
    type RevenueCenter,
    type RoutePath,
    type TileEndpoint
} from '@tabletop/18xx'
import { LondonLocationId, Majors1822, Minors1822, MetropolitanId } from './companies.js'
import { LondonNodeIds } from './faces.js'
import {
    EstuaryCost1822,
    FranceLocationId,
    LondonApproachLocationIds,
    LondonStopGroup,
    Map1822,
    MerthyrToPontypoolSide,
    MerthyrTydfilLocationId,
    MidWalesLocationId,
    OystermouthNodeId,
    PontypoolLocationId,
    PontypoolToMerthyrSide,
    SwanseaLocationId
} from './map.js'
import { EnglishChannelLocationId, GrimsbyLocationId, HullLocationId } from './privates.js'
import { TileSet1822 } from './tiles.js'
import { revenueStages1822 } from './trains.js'

const locations = Map1822.definition.locations
const network = new RouteNetwork(
    new RailwayMapState(Map1822, TileSet1822, TileSet1822.createInventory())
)

const city = (locationId: string): RevenueCenter => ({ locationId, nodeId: 'city' })
const path = (locationId: string, pathId: string): RoutePath => ({ locationId, pathId })

function trace(start: RevenueCenter, paths: readonly RoutePath[]) {
    const { trace, reason } = network.trace(start, paths)
    if (!trace) throw new Error(reason)
    return trace
}

function stopValues(locationId: string, nodeId = 'city'): number[] {
    const node = Map1822.location(locationId).preprintedTile.nodes.find(({ id }) => id === nodeId)
    if (!node || node.kind === 'junction') throw new Error(`${locationId} has no stop ${nodeId}`)
    return ['1', '2', '3', '4', '5', '6', '7'].map((phaseId) =>
        routeRevenue(node.revenue, revenueStages1822(phaseId))
    )
}

function edgeEnds(locationId: string): Extract<TileEndpoint, { kind: 'edge' }>[] {
    return Map1822.location(locationId).preprintedTile.paths.flatMap((track) =>
        track.endpoints.flatMap((end) => (end.kind === 'edge' ? [end] : []))
    )
}

describe('the map (§1.2)', () => {
    it('has every hex of the board once, E32 beside Merthyr Tydfil being off the map', () => {
        expect(locations).toHaveLength(208)
        expect(locations.some(({ id }) => id === 'E32')).toBe(false)
        expect(new Set(locations.map(({ id }) => id)).size).toBe(locations.length)
    })

    it('leaves only the grey areas and the sea fixed', () => {
        expect(
            locations
                .filter((location) => !location.buildable)
                .map(({ id }) => id)
                .sort()
        ).toEqual(
            [
                'A42 C34 E2 E4 E6 E28 E34 F23 F25 F27 F29 F31 F33 H1 Q44',
                'F15 F17 F21 J43 L11 Q36 Q42 R31'
            ]
                .join(' ')
                .split(' ')
                .sort()
        )
    })

    it('runs printed track only to track of the same lane or to a hex that can be built on (§5.8.6)', () => {
        for (const location of locations)
            for (const end of edgeEnds(location.id)) {
                const across = Map1822.across(location.id, end.edge)
                expect(across, `${location.id} edge ${end.edge}`).toBeDefined()
                if (!across) continue
                const facing = edgeEnds(across.location.id).some((other) =>
                    sameTileEndpoint(other, { ...end, edge: across.edge })
                )
                expect(facing || across.location.buildable, `${location.id} edge ${end.edge}`).toBe(
                    true
                )
            }
    })

    it('marks each red border and each estuary on both of its sides (§5.8.6, §5.8.9)', () => {
        for (const location of locations)
            for (const border of location.borders ?? []) {
                const neighbor = Map1822.neighbor(location.id, border.edge)
                expect(neighbor, `${location.id} edge ${border.edge}`).toBeDefined()
                expect(
                    neighbor?.borders?.find(
                        (other) => other.edge === rotateTileEdge(border.edge, 3)
                    ),
                    `${location.id} edge ${border.edge}`
                ).toEqual({ ...border, edge: rotateTileEdge(border.edge, 3) })
                if (border.kind === 'water') expect(border.cost).toBe(EstuaryCost1822)
            }
    })

    it('puts the Humber estuary between Hull and Grimsby (Table 3, P21)', () => {
        expect(Map1822.neighbor(HullLocationId, 0)?.id).toBe(GrimsbyLocationId)
        expect(Map1822.location(HullLocationId).borders).toEqual([
            { edge: 0, kind: 'water', cost: 40 }
        ])
        expect(Map1822.location(GrimsbyLocationId).borders).toEqual([
            { edge: 3, kind: 'water', cost: 40 }
        ])
    })

    it('prices difficult terrain: rivers £20 and £40, rough £40, hills £60, mountains £80 (§5.8.9)', () => {
        const costs = (kind: string) => [
            ...new Set(
                locations.flatMap((location) =>
                    location.terrain?.kinds.includes(kind) ? [location.terrain.cost] : []
                )
            )
        ]
        expect(costs('water').sort()).toEqual([20, 40])
        expect(costs('rough')).toEqual([40])
        expect(costs('hill')).toEqual([60])
        expect(costs('mountain')).toEqual([80])
        expect(
            locations
                .filter((location) => location.terrain)
                .every(({ terrain }) =>
                    ['water', 'rough', 'hill', 'mountain'].includes(terrain?.kinds[0] ?? '')
                )
        ).toBe(true)
    })

    it('charges terrain on the pre-printed Birmingham, Manchester and Bristol (§5.8.10)', () => {
        const printedYellow = locations.filter(
            (location) => location.preprintedTile.color === 'yellow'
        )
        expect(printedYellow.map(({ name }) => name).sort()).toEqual([
            'Birmingham',
            'Bristol',
            'Cardiff',
            'Edinburgh',
            'English Channel',
            'Liverpool',
            'Manchester'
        ])
        expect(
            printedYellow
                .filter(({ terrain }) => terrain)
                .map(({ name, terrain }) => [name, terrain?.cost])
        ).toEqual([
            ['Bristol', 20],
            ['Manchester', 60],
            ['Birmingham', 40]
        ])
    })

    it('labels the pre-printed yellow cities B-M, Y, C and EC (§5.8.3)', () => {
        const labelled = (label: string) =>
            locations
                .filter((location) => location.preprintedTile.labels.includes(label))
                .map(({ name }) => name)
                .sort()
        expect(labelled('BM')).toEqual(['Birmingham', 'Manchester'])
        expect(labelled('Y')).toEqual(['Bristol', 'Edinburgh', 'Liverpool'])
        expect(labelled('C')).toEqual(['Cardiff'])
        expect(labelled('EC')).toEqual(['English Channel'])
        expect(labelled('L')).toEqual(['London'])
    })

    it('labels Swansea S and Plymouth, Portsmouth and Brighton T from green on (§5.8.3)', () => {
        const from = (label: string) =>
            locations
                .filter((location) =>
                    location.upgradeLabels?.some(
                        (entry) => entry.label === label && entry.color === 'green'
                    )
                )
                .map(({ name }) => name)
                .sort()
        expect(from('S')).toEqual(['Swansea & Oystermouth'])
        expect(from('T')).toEqual(['Brighton', 'Plymouth', 'Portsmouth'])
    })
})

describe('London (§1.2.3, §5.10)', () => {
    const london = Map1822.location(LondonLocationId)

    it('is six separate stations worth £20, each with track to its own side', () => {
        expect(london.preprintedTile.nodes).toHaveLength(6)
        for (const [edge, nodeId] of LondonNodeIds.entries()) {
            expect(stopValues(LondonLocationId, nodeId)[0]).toBe(20)
            expect(
                london.preprintedTile.paths.filter((track) =>
                    track.endpoints.some((end) => end.kind === 'node' && end.nodeId === nodeId)
                )
            ).toMatchObject([
                {
                    endpoints: [
                        { kind: 'edge', edge },
                        { kind: 'node', nodeId }
                    ]
                }
            ])
        }
        expect(london.preprintedTile.upgradeCost).toBe(20)
        expect(london.buildable).toBe(true)
    })

    it('counts once on a route, whichever stations it uses (§5.4.2)', () => {
        expect(london.stopGroup).toBe(LondonStopGroup)
    })

    it('keeps a station for each London company (Tables 4 and 6)', () => {
        expect(
            Object.fromEntries(
                (london.reservations ?? []).map(({ companyId, nodeId }) => [nodeId, companyId])
            )
        ).toEqual({ s: 'LBSCR', sw: 'GWR', nw: 'M16', n: 'LNWR', ne: 'M15', se: 'SECR' })
    })

    it('is surrounded by the six hexes kept for those companies (§5.10.7)', () => {
        for (const [edge, nodeId] of LondonNodeIds.entries())
            expect(Map1822.neighbor(LondonLocationId, rotateTileEdge(0, edge))?.id).toBe(
                LondonApproachLocationIds[nodeId]
            )
    })
})

describe('the homes and destinations (Tables 4 and 6)', () => {
    it('keep a station space in a city for every company but the Metropolitan (§2.1.11)', () => {
        for (const company of [...Majors1822, ...Minors1822]) {
            const reserved = Map1822.stationReservations().filter(
                (reservation) => reservation.companyId === company.id
            )
            if (!company.home) {
                expect(company.id).toBe(MetropolitanId)
                expect(reserved).toEqual([])
                continue
            }
            expect(reserved).toEqual([{ companyId: company.id, ...company.home }])
            expect(
                Map1822.location(company.home.locationId).preprintedTile.nodes.find(
                    (node) => node.id === company.home?.nodeId
                )?.kind
            ).toBe('city')
        }
    })

    it('send each major to a city by name', () => {
        expect(
            Majors1822.map(({ id, home, destination }) => [
                id,
                Map1822.placeName(home.locationId),
                Map1822.placeName(destination.locationId)
            ])
        ).toEqual([
            ['LNWR', 'London', 'Manchester'],
            ['GWR', 'London', 'Bristol'],
            ['LBSCR', 'London', 'Brighton'],
            ['SECR', 'London', 'Dover'],
            ['CR', 'Glasgow', 'Carlisle'],
            ['MR', 'Derby', 'York'],
            ['LYR', 'Liverpool', 'Manchester'],
            ['NBR', 'Edinburgh', 'Aberdeen'],
            ['SWR', 'Gloucester', 'Fishguard'],
            ['NER', 'York', 'Edinburgh']
        ])
        for (const { destination } of Majors1822)
            expect(
                Map1822.location(destination.locationId).preprintedTile.nodes.find(
                    (node) => node.id === destination.nodeId
                )?.kind
            ).toBe('city')
    })

    it('start each minor where Table 4 names it', () => {
        expect(
            Object.fromEntries(
                Minors1822.map(({ id, home }) => [id, home && Map1822.placeName(home.locationId)])
            )
        ).toEqual({
            M1: 'Aberdeen',
            M2: 'Highlands',
            M3: 'Edinburgh',
            M4: 'Newcastle',
            M5: 'Darlington',
            M6: 'Barrow',
            M7: 'Warrington',
            M8: 'Sheffield',
            M9: 'Grimsby',
            M10: 'Birmingham',
            M11: 'Peterborough',
            M12: 'Ipswich',
            M13: 'Maidstone',
            M14: undefined,
            M15: 'London',
            M16: 'London',
            M17: 'Southampton',
            M18: 'Bournemouth',
            M19: 'Cardiff',
            M20: 'Pontypool',
            M21: 'Merthyr Tydfil',
            M22: 'Exeter',
            M23: 'Cornwall',
            M24: 'Swansea & Oystermouth',
            M25: 'Norwich',
            M26: 'Hull',
            M27: 'Glasgow',
            M28: 'Carlisle',
            M29: 'Mid Wales',
            M30: 'Plymouth'
        })
    })
})

describe('the grey areas (§5.4.4, §5.4.5)', () => {
    it('pay their yellow, green, brown and grey values by phase', () => {
        expect(stopValues('A42')).toEqual([40, 40, 30, 30, 30, 30, 40])
        expect(stopValues('C34')).toEqual([10, 10, 20, 20, 30, 30, 40])
        expect(stopValues('E2')).toEqual([10, 10, 10, 10, 20, 20, 20])
        expect(stopValues('E6')).toEqual([40, 40, 50, 50, 60, 60, 70])
        expect(stopValues(MidWalesLocationId)).toEqual([10, 10, 20, 20, 20, 20, 30])
        expect(stopValues(MerthyrTydfilLocationId)).toEqual([30, 30, 40, 40, 30, 30, 10])
        expect(stopValues('F23')).toEqual([20, 20, 20, 20, 30, 30, 40])
        expect(stopValues(PontypoolLocationId)).toEqual([20, 20, 40, 40, 30, 30, 10])
        expect(stopValues('H1')).toEqual([30, 30, 40, 40, 50, 50, 60])
        expect(stopValues(FranceLocationId, 'offboard')).toEqual([0, 0, 60, 60, 90, 90, 120])
    })

    it('are cities with station spaces: three in Glasgow and Mid Wales, two in the others', () => {
        const slots = (locationId: string) =>
            Map1822.location(locationId).preprintedTile.nodes.map((node) =>
                node.kind === 'city' ? node.stationSlots : node.kind
            )
        for (const id of ['E6', MidWalesLocationId]) expect(slots(id)).toEqual([3])
        for (const id of ['A42', 'C34', 'E2', 'F23', 'H1', 'E34', 'F33'])
            expect(slots(id)).toEqual([2])
        expect(slots(FranceLocationId)).toEqual(['offboard'])
    })

    it('end routes at the standard off-board areas, which Glasgow is not (§5.4.4)', () => {
        const termini = (locationId: string) =>
            Map1822.location(locationId).preprintedTile.paths.map((track) => !!track.terminus)
        for (const id of ['A42', 'C34', 'E2', MidWalesLocationId, 'F23', 'H1'])
            expect(new Set(termini(id)), id).toEqual(new Set([true]))
        expect(new Set(termini('E6'))).toEqual(new Set([false]))
    })

    it('let the Highlands minor run to Glasgow, but nothing run through the Highlands (§5.4.4)', () => {
        const toGlasgow = trace(city('E2'), [
            path('E2', 'edge-0'),
            path('E4', 'path-0'),
            path('E6', 'edge-3')
        ])
        expect(toGlasgow.visits.map((visit) => [visit.locationId, visit.terminus])).toEqual([
            ['E2', undefined],
            ['E6', undefined]
        ])
        const toHighlands = trace(city('E6'), [
            path('E6', 'edge-3'),
            path('E4', 'path-0'),
            path('E2', 'edge-0')
        ])
        expect(toHighlands.visits.at(-1)).toMatchObject({ locationId: 'E2', terminus: true })
    })

    it('join Merthyr Tydfil and Pontypool across their shared side by one track that ends a route at either (§5.4.7)', () => {
        expect(Map1822.neighbor(MerthyrTydfilLocationId, MerthyrToPontypoolSide)?.id).toBe(
            PontypoolLocationId
        )
        expect(Map1822.neighbor(PontypoolLocationId, PontypoolToMerthyrSide)?.id).toBe(
            MerthyrTydfilLocationId
        )
        const crossing = [
            path(MerthyrTydfilLocationId, `edge-${MerthyrToPontypoolSide}`),
            path(PontypoolLocationId, `edge-${PontypoolToMerthyrSide}`)
        ]
        const fromCardiff = trace(city('F35'), [
            path('F35', 'edge-2'),
            path(MerthyrTydfilLocationId, 'edge-5'),
            ...crossing
        ])
        expect(fromCardiff.visits.map((visit) => [visit.locationId, visit.terminus])).toEqual([
            ['F35', undefined],
            [MerthyrTydfilLocationId, undefined],
            [PontypoolLocationId, true]
        ])
        const back = trace(city(PontypoolLocationId), [...crossing].reverse())
        expect(back.visits.at(-1)).toMatchObject({
            locationId: MerthyrTydfilLocationId,
            terminus: true
        })
        // The one connection uses one track, so a second train cannot cross (§5.4.7).
        expect(new Set(back.resources)).toEqual(new Set(trace(city('E34'), crossing).resources))
    })

    it('reach Mid Wales by eight tracks of their own, none from Holyhead or Pontypool (§1.2.4)', () => {
        const entries: string[] = []
        const used = new Set<string>()
        for (const first of Map1822.location(MidWalesLocationId).preprintedTile.paths) {
            const paths = [path(MidWalesLocationId, first.id)]
            for (;;) {
                const [next, ...others] = network.extensions(city(MidWalesLocationId), paths)
                if (!next) break
                expect(others).toEqual([])
                paths.push(next)
            }
            const { end, resources, visits } = trace(city(MidWalesLocationId), paths)
            expect(visits).toHaveLength(1)
            expect(end.endpoint.kind).toBe('edge')
            if (end.endpoint.kind !== 'edge') continue
            entries.push(Map1822.neighbor(end.locationId, end.endpoint.edge)?.id ?? '')
            for (const resource of resources) {
                expect(used.has(resource), resource).toBe(false)
                used.add(resource)
            }
        }
        expect(entries.sort()).toEqual(['G24', 'G26', 'G26', 'G28', 'G28', 'G30', 'G30', 'G32'])
    })
})

describe('the English Channel and France (§5.4.6, §5.9)', () => {
    const channel = Map1822.location(EnglishChannelLocationId)

    it('starts yellow without track, a station of no value that is no stop of its own', () => {
        expect(channel.preprintedTile).toMatchObject({
            color: 'yellow',
            paths: [],
            labels: ['EC'],
            upgradeCost: 100,
            nodes: [{ kind: 'city', stationSlots: 1, uncounted: true }]
        })
        expect(stopValues(EnglishChannelLocationId)[0]).toBe(0)
    })

    it('lies between Dover, Folkestone and France', () => {
        expect(
            [2, 3, 5].map(
                (edge) => Map1822.neighbor(EnglishChannelLocationId, rotateTileEdge(0, edge))?.name
            )
        ).toEqual(['Folkestone', 'Dover', 'France'])
    })

    it('offers France two tracks (§5.9.2)', () => {
        expect(edgeEnds(FranceLocationId)).toEqual([
            { kind: 'edge', edge: 2 },
            { kind: 'edge', edge: 2, lane: 1 }
        ])
    })
})

describe('Swansea and the sea (§1.2.2, §5.8.4, §5.8.8)', () => {
    it('lets the Swansea and Mumbles Railway run for £30 before any track is laid', () => {
        const run = trace(city(SwanseaLocationId), [path(SwanseaLocationId, 'oystermouth')])
        expect(run.visits.map((visit) => visit.nodeId)).toEqual(['city', OystermouthNodeId])
        expect(
            stopValues(SwanseaLocationId)[0] + stopValues(SwanseaLocationId, OystermouthNodeId)[0]
        ).toBe(30)
        expect(Map1822.location(SwanseaLocationId).buildable).toBe(true)
    })

    it('puts each off-shore arrow beside a coastal town or city', () => {
        const coastal = locations
            .filter((location) => location.preprintedTile.color === 'blue')
            .map((location) => {
                const [end] = edgeEnds(location.id)
                return Map1822.neighbor(location.id, end.edge)?.name
            })
        expect(coastal.sort()).toEqual([
            'Barrow',
            'Barrow',
            'Bournemouth',
            'Dover',
            'Ipswich',
            'Liverpool',
            'Newcastle',
            'Norwich'
        ])
    })
})
