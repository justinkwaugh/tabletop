import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ReserveBidAuction,
    StandardTileCatalog,
    StationPlacement,
    TrackConstruction,
    EighteenXXStateValidator,
    rotateTileFace,
    tileUpgradeMappings,
    type EighteenXXState,
    type TileRotation
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Definition } from './definition/gameDefinition.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'
import {
    EighteenThirtyAuctionRules,
    EighteenThirtyMap,
    EighteenThirtyStationRules,
    EighteenThirtyTileSet,
    EighteenThirtyTrackRules
} from './index.js'

const Rotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]

// Plays the opening auction, floats Erie at $100 and passes to Erie's first operating turn,
// optionally changing the map before the stock round ends.
function erieOperates(prepareMap: (state: EighteenXXState) => EighteenXXState = (state) => state) {
    const { game, engine, state: initial } = exampleGame(EighteenThirtyScenarios, 'opening', 3)
    let state: EighteenXXState = initial
    const act = (type: string, fields: object = {}) => {
        const action: GameAction = {
            id: `action:${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId: state.activePlayerIds[0],
            type,
            ...fields
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        expect(EighteenXXStateValidator.Check(state)).toBe(true)
    }
    const player = () => ({ kind: 'player', playerId: state.activePlayerIds[0] }) as const
    while (state.machineState === 'WaterfallAuction') {
        const auction = new ReserveBidAuction(state, EighteenThirtyAuctionRules)
        const lotId = auction.auction.remainingLotIds[0]
        act('BuyAuctionLot', { lotId, expectedPrice: auction.price(lotId) })
    }
    act('StartCompany', {
        buyer: player(),
        companyId: 'ERIE',
        marketSpaceId: '0:6',
        expectedPrice: 200
    })
    act('FinishStockTurn')
    for (const share of [1, 2, 3, 4]) {
        act('BuyShares', {
            buyer: player(),
            certificateId: `ERIE:share:${share}`,
            expectedPrice: 100
        })
        act('FinishStockTurn')
    }
    state = prepareMap(state)
    expect(EighteenXXStateValidator.Check(state)).toBe(true)
    while (state.machineState === 'StockRound') act('FinishStockTurn')
    return {
        get state() {
            return state
        },
        act,
        valid: (playerId: string) => engine.getValidActionTypesForPlayer(game, state, playerId)
    }
}

describe("Erie's whole-hex home", () => {
    it('keeps other companies out of both Buffalo cities until Erie places its home', () => {
        const { state } = exampleGame(EighteenThirtyScenarios, 'opening', 3)
        const placement = new StationPlacement(state, EighteenThirtyStationRules)
        expect(placement.openSlots('PRR', 'E11', 'city-0')).toEqual([])
        expect(placement.openSlots('PRR', 'E11', 'city-1')).toEqual([])
        expect(placement.openSlots('ERIE', 'E11', 'city-1')).toEqual([0])
    })

    it('places Erie in the first Buffalo city while Buffalo has no track', () => {
        const game = erieOperates()
        expect(game.state.stations.find((station) => station.id === 'ERIE:home')).toMatchObject({
            status: 'placed',
            position: { locationId: 'E11', nodeId: 'city-0' }
        })
        expect(
            game.state.stationReservations.filter((reservation) => reservation.companyId === 'ERIE')
        ).toEqual([])
        expect(game.state.machineState).toBe('LayingTrack')
        expect(game.state.trackStep?.companyId).toBe('ERIE')
    })

    it("lets Erie's president choose a Buffalo city once Buffalo has track", () => {
        const game = erieOperates((state) => ({
            ...state,
            tileInventory: EighteenThirtyTileSet.createInventory([
                { locationId: 'E11', definitionId: '18xx:59', rotation: 0 }
            ])
        }))
        const president = game.state.activePlayerIds[0]
        expect(game.state.machineState).toBe('OperatingSet')
        expect(game.valid(president)).toEqual(['ChooseHomeStation'])
        game.act('ChooseHomeStation', { companyId: 'ERIE', locationId: 'E11', nodeId: 'city-1' })
        expect(game.state.stations.find((station) => station.id === 'ERIE:home')).toMatchObject({
            status: 'placed',
            position: { locationId: 'E11', nodeId: 'city-1' }
        })
        expect(
            game.state.stationReservations.filter((reservation) => reservation.companyId === 'ERIE')
        ).toEqual([])
        expect(game.state.machineState).toBe('LayingTrack')
    })

    it("upgrades Buffalo to #59 with Erie's station still in its city, once per rotation", () => {
        const game = erieOperates()
        const choices = new TrackConstruction(
            { ...game.state, phaseId: '3' },
            EighteenThirtyTrackRules
        ).choices('E11')
        expect(choices.length).toBeGreaterThan(0)
        expect(new Set(choices.map((choice) => choice.rotation)).size).toBe(choices.length)
        for (const choice of choices) {
            expect(choice.definitionId).toBe('18xx:59')
            expect(choice.nodeMapping).toEqual({ 'city-0': 'city-0', 'city-1': 'city-1' })
            expect(choice.stations.find((station) => station.id === 'ERIE:home')).toMatchObject({
                position: { locationId: 'E11', nodeId: 'city-0' }
            })
        }
    })
})

describe('two-city upgrades', () => {
    it("keeps NYNH's New York reservation on the city joined to its printed track", () => {
        const before = EighteenThirtyMap.location('G19').preprintedTile
        const after = StandardTileCatalog.get('18xx:54').face
        const mappings = Rotations.flatMap((rotation) =>
            tileUpgradeMappings(before, rotateTileFace(after, rotation)).map((mapping) => ({
                rotation,
                mapping
            }))
        )
        expect(mappings.length).toBeGreaterThan(0)
        for (const { rotation, mapping } of mappings) {
            const target = rotateTileFace(after, rotation).paths.filter((path) =>
                path.endpoints.some(
                    (end) => end.kind === 'node' && end.nodeId === mapping['city-0']
                )
            )
            expect(
                target.some((path) =>
                    path.endpoints.some((end) => end.kind === 'edge' && end.edge === 3)
                )
            ).toBe(true)
        }
    })

    it('offers each rotation of a tile on an empty two-town hex once', () => {
        const { state } = exampleGame(EighteenThirtyScenarios, 'construction', 3)
        const choices = new TrackConstruction(
            {
                ...state,
                stations: state.stations.map((station) =>
                    station.id === 'PRR:station:1'
                        ? {
                              id: station.id,
                              companyId: 'PRR',
                              status: 'placed',
                              position: { locationId: 'F6', nodeId: 'city', slot: 0 }
                          }
                        : station
                )
            },
            EighteenThirtyTrackRules
        ).choices('G7')
        expect(choices.length).toBeGreaterThan(0)
        const placements = choices.map((choice) => `${choice.definitionId}/${choice.rotation}`)
        expect(new Set(placements).size).toBe(placements.length)
    })
})

it('registers the home choice only for titles that offer it', () => {
    expect(Object.keys(Definition.runtime.apiActions)).toContain('ChooseHomeStation')
})
