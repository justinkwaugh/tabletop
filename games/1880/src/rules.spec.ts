import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    RouteNetwork,
    TileEdges,
    TrackConstruction,
    rotateTileFace,
    trainsOwnedBy,
    type RoutePath,
    type TileEdge
} from '@tabletop/18xx'
import { edit, holderOf, opened, placeTile, startMajor, type Table } from '../test/kit.js'
import { Map1880, RussiaLocationId, TaiwanLocationId } from './map.js'
import { RouteRules1880, TaiwanBonus } from './routes.js'
import { marketBonus } from './stockMarket.js'
import { TileSet1880, tileFace1880 } from './tiles.js'
import { TrackRules1880 } from './track.js'
import { TrainRules1880 } from './trainRules.js'

/** A table whose first player directs the CKR and owns the private given. */
function withPrivate(privateId: string) {
    const game = opened(4, 3)
    while (holderOf(game, 'BCR:president') === game.player) game.act('FinishStockTurn')
    const director = game.player
    startMajor(game, 'CKR')
    edit(game, (state) => {
        const charter = state.certificates.find(
            (certificate) => certificate.id === `${privateId}:charter`
        )
        if (charter) charter.owner = { kind: 'player', playerId: director }
    })
    return game
}

const StraightCityTileId = '18xx:57'

function layCityFacing(game: Table, locationId: string, edge: TileEdge): RoutePath {
    const across = Map1880.across(locationId, edge)
    assertExists(across, `${locationId} has a neighbour across side ${edge}`)
    const [facing] = TileEdges.flatMap((rotation) =>
        rotateTileFace(tileFace1880(StraightCityTileId), rotation)
            .paths.filter((path) =>
                path.endpoints.some((end) => end.kind === 'edge' && end.edge === across.edge)
            )
            .map((track) => ({ rotation, track }))
    )
    assertExists(facing, 'The straight city turns to face every side')
    placeTile(game, across.location.id, StraightCityTileId, facing.rotation)
    return { locationId: across.location.id, pathId: facing.track.id }
}

describe('off-board areas and harbours (§X Operating Trains)', () => {
    it.each([
        ['Russia', RussiaLocationId, 4, 5],
        ['French Indochina', 'Q7', 2, 3],
        ['Taiwan', TaiwanLocationId, 0, 1],
        ['Haikou', 'Q13', 2, 3]
    ] as const)('ends a route that reaches %s', (_name, locationId, arrival, departure) => {
        const game = opened(4, 3)
        const from = layCityFacing(game, locationId, arrival)
        layCityFacing(game, locationId, departure)
        const network = new RouteNetwork(
            new RailwayMapState(Map1880, TileSet1880, game.state.tileInventory)
        )
        const start = { locationId: from.locationId, nodeId: 'city' }
        const reaching: RoutePath[] = [from, { locationId, pathId: `edge-${arrival}` }]
        expect(network.trace(start, reaching).trace).toBeDefined()
        expect(
            network.trace(start, [...reaching, { locationId, pathId: `edge-${departure}` }]).reason
        ).toBe('A route ends where it reaches a terminus.')
    })
})

describe('route values (§X Calculating Income)', () => {
    it('charges ¥10 a ferry unless the company’s director owns P2', () => {
        const without = withPrivate('P1')
        expect(RouteRules1880.hexBonus?.(without.hydrated, 'F12', 'CKR')).toBe(-10)
        const owner = withPrivate('P2')
        expect(RouteRules1880.hexBonus?.(owner.hydrated, 'F12', 'CKR')).toBe(0)
        expect(RouteRules1880.hexBonus?.(owner.hydrated, 'G13', 'CKR')).toBe(0)
    })

    it('adds ¥20 to Taiwan for the companies P3’s owner directs', () => {
        const game = withPrivate('P3')
        const train = TrainRules1880.depot.trainDefinition('2')
        const taiwan = { locationId: 'N16', nodeId: 'town' }
        expect(RouteRules1880.stopBonus?.(game.hydrated, train, 'CKR', taiwan)).toBe(TaiwanBonus)
        expect(RouteRules1880.stopBonus?.(game.hydrated, train, 'BCR', taiwan)).toBe(0)
    })

    it('pays ten times the bonus printed under the price', () => {
        expect(marketBonus('1:5')).toBe(50)
        expect(marketBonus('2:8')).toBe(100)
        expect(marketBonus('3:10')).toBe(150)
        expect(marketBonus('1:12')).toBe(200)
        expect(marketBonus('0:13')).toBe(400)
        expect(marketBonus('1:3')).toBe(0)
    })

    it('counts an E-train’s best stations, one its own', () => {
        const train = TrainRules1880.depot.trainDefinition('8E')
        const game = opened(4, 3)
        expect(RouteRules1880.revenuePolicy?.(train, game.hydrated, 'BCR')).toMatchObject({
            payingStopLimit: 8,
            requirePayingStation: true
        })
    })
})

describe('building (§VIII, §X)', () => {
    it('takes ¥20 off river hexes for the companies P4’s owner directs', () => {
        const game = withPrivate('P4')
        const request = {
            companyId: 'CKR',
            locationId: 'G5',
            definitionId: '18xx:7',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRules1880.terrainCost?.(game.hydrated, request, 50)).toBe(30)
        expect(
            TrackRules1880.terrainCost?.(game.hydrated, { ...request, locationId: 'B4' }, 30)
        ).toBe(30)
        expect(
            TrackRules1880.terrainCost?.(game.hydrated, { ...request, companyId: 'BCR' }, 50)
        ).toBe(50)
    })

    it('lets a company build only in the phases of its permits', () => {
        const game = opened(4, 3)
        edit(game, (state) => {
            state.permits.BCR = 'BCD'
            state.trackStep = { companyId: 'BCR', lays: [], completed: false }
        })
        expect(TrackRules1880.allowance(game.hydrated, 'yellow')).toHaveProperty('reason')
        edit(game, (state) => {
            state.permits.BCR = 'ABC'
        })
        expect(TrackRules1880.allowance(game.hydrated, 'yellow')).toEqual({ cost: 0 })
    })

    it('lets a medium city take a city or a town tile first (§X Laying Track)', () => {
        // JHA's Beijing city faces E9, a medium city holding Beijing's starting section.
        const game = opened(4, 3)
        while (holderOf(game, 'BCR:president') === game.player) game.act('FinishStockTurn')
        startMajor(game, 'JHA')
        edit(game, (state) => {
            const home = state.stations.find((station) => station.id === 'JHA:home')
            assertExists(home, 'JHA has a home station')
            Object.assign(home, {
                status: 'placed',
                position: { locationId: 'F8', nodeId: 'city-2', slot: 0 }
            })
            state.trackStep = { companyId: 'JHA', lays: [], completed: false }
        })
        const laid = new Set(
            new TrackConstruction(game.hydrated, TrackRules1880)
                .choices('E9')
                .map((choice) => choice.definitionId)
        )
        expect(laid).toContain('18xx:57')
        expect(laid).toContain('1880:8850')
        expect(laid).not.toContain('18xx:7')
    })

    it('lets a double medium city take two towns or an OO tile first (§X Laying Track)', () => {
        // The BCR's home Chengdu faces N4, a double medium city.
        const game = opened(4, 3)
        const across = TileEdges.find((edge) => Map1880.across('N4', edge)?.location.id === 'M3')
        assertExists(across, 'N4 borders M3')
        layCityFacing(game, 'N4', across)
        edit(game, (state) => {
            const home = state.stations.find((station) => station.id === 'BCR:home')
            assertExists(home, 'The BCR has a home station')
            Object.assign(home, {
                status: 'placed',
                position: { locationId: 'M3', nodeId: 'city', slot: 0 }
            })
            state.permits.BCR = 'ABC'
            const treasury = state.cash.find(
                (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'BCR'
            )
            assertExists(treasury, 'The BCR has a treasury')
            treasury.amount = 100
            state.trackStep = { companyId: 'BCR', lays: [], completed: false }
        })
        const laid = new Set(
            new TrackConstruction(game.hydrated, TrackRules1880)
                .choices('N4')
                .map((choice) => choice.definitionId)
        )
        expect(laid).toContain('1880:235')
        expect(laid).toContain('1880:8854')
        expect(laid).not.toContain('18xx:57')
        expect(laid).not.toContain('1880:8850')
    })
})

describe('trains (§X, §XI)', () => {
    it('sells only the next kind of train, and restored 2-trains from the first 6-train', () => {
        const game = opened(4, 3)
        expect(TrainRules1880.availableDefinitions(game.hydrated)).toEqual(['2'])
        edit(game, (state) => {
            state.phaseId = 'C2'
        })
        expect(TrainRules1880.availableDefinitions(game.hydrated)).toContain('2R')
    })

    it('limits a company to one restored 2-train, which does not count as its train', () => {
        const game = opened(4, 3)
        edit(game, (state) => {
            const train = state.trainInventory.trains.find((entry) => entry.definitionId === '2R')
            if (train)
                Object.assign(train, {
                    status: 'owned',
                    owner: { kind: 'company', companyId: 'BCR' }
                })
        })
        const [owned] = trainsOwnedBy(game.hydrated, { kind: 'company', companyId: 'BCR' })
        expect(TrainRules1880.limitReason?.(game.hydrated, 'BCR', '2R')).toBeDefined()
        expect(owned && TrainRules1880.satisfiesRequirement?.(game.hydrated, owned)).toBe(false)
        expect(TrainRules1880.limitReason?.(game.hydrated, 'A1', '2')).toBeDefined()
    })
})
