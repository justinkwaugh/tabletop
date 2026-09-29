import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    ClockwisePointyHexDirections,
    Color,
    GameEngine,
    PlayerStatus,
    PointyHexDirection,
    type AxialCoordinates
} from '@tabletop/common'
import { BOARD_GRID, neighborCoords, offsetToAxial } from '../components/boardGrid.js'
import { cityPlaceId, villagePlaceId } from '../components/places.js'
import { Definition } from '../definition/definition.js'
import { MagnaGreciaRuntime } from '../definition/runtime.js'
import { HydratedBuildMarket } from '../actions/buildMarket.js'
import { HydratedEndTurn } from '../actions/endTurn.js'
import { HydratedPlaceCity } from '../actions/placeCity.js'
import { HydratedPlaceRoad } from '../actions/placeRoad.js'
import { HydratedResupply } from '../actions/resupply.js'
import { HydratedSellMarket } from '../actions/sellMarket.js'
import { ActionType } from '../definition/actions.js'
import type { RoadEnds } from '../components/pieces.js'
import type { HydratedMagnaGreciaGameState } from './gameState.js'
import { marketCost, marketValue } from './marketRules.js'
import { ROAD_END_OPTIONS, RoadShape, roadShape } from './roadRules.js'
import { newTurn } from './turn.js'

const E = PointyHexDirection.East
const W = PointyHexDirection.West
const SE = PointyHexDirection.Southeast
const SW = PointyHexDirection.Southwest
const NE = PointyHexDirection.Northeast
const NW = PointyHexDirection.Northwest

const engine = new GameEngine(MagnaGreciaRuntime)

const FRONTIER = offsetToAxial({ row: 0, col: 1 })
const INLAND = offsetToAxial({ row: 2, col: 3 })

function createGame(count: number) {
    return MagnaGreciaRuntime.initializer.initializeGame(
        {
            id: 'magna-grecia-rules',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 1234,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function freshState(count = 3): HydratedMagnaGreciaGameState {
    const { initialState } = engine.startGame(createGame(count))
    const state = MagnaGreciaRuntime.hydrator.hydrateState(initialState)
    state.board.oracles = []
    return state
}

function giveTurn(state: HydratedMagnaGreciaGameState, playerId: string, cardId: string) {
    state.deck[state.round] = cardId
    state.turn = newTurn(playerId)
}

function base(playerId: string) {
    return { id: 'a', gameId: 'g', source: ActionSource.User, playerId }
}

function placeCity(
    state: HydratedMagnaGreciaGameState,
    playerId: string,
    coords: AxialCoordinates
) {
    const action = new HydratedPlaceCity({ ...base(playerId), type: ActionType.PlaceCity, coords })
    action.apply(state)
    return action
}

function placeRoad(
    state: HydratedMagnaGreciaGameState,
    playerId: string,
    coords: AxialCoordinates,
    ends: RoadEnds
) {
    const action = new HydratedPlaceRoad({
        ...base(playerId),
        type: ActionType.PlaceRoad,
        coords,
        ends
    })
    action.apply(state)
    return action
}

function at(coords: AxialCoordinates, direction: PointyHexDirection): AxialCoordinates {
    return neighborCoords(coords, direction)
}

describe('board map', () => {
    it('has ten frontier villages and thirty-two inland villages, none adjacent', () => {
        const villages = BOARD_GRID.villages()
        expect(villages.filter((space) => space.frontier)).toHaveLength(10)
        expect(BOARD_GRID.inlandVillages()).toHaveLength(32)
        for (const village of villages) {
            for (const direction of ClockwisePointyHexDirections) {
                const neighbor = BOARD_GRID.space(at(village.coords, direction))
                expect(neighbor?.type).not.toBe('Village')
            }
        }
    })

    it('offers nine road orientations: three straight and six curved', () => {
        const shapes = ROAD_END_OPTIONS.map(roadShape)
        expect(shapes.filter((shape) => shape === RoadShape.Straight)).toHaveLength(3)
        expect(shapes.filter((shape) => shape === RoadShape.Curve)).toHaveLength(6)
    })
})

describe('setup', () => {
    it.each([
        [2, 10, 7],
        [3, 12, 7],
        [4, 15, 9]
    ])(
        '%i players start on %i points with %i oracles on inland villages',
        (count, points, oracles) => {
            const { initialState } = engine.startGame(createGame(count))
            const state = MagnaGreciaRuntime.hydrator.hydrateState(initialState)
            expect(state.players.every((player) => player.points === points)).toBe(true)
            expect(state.board.oracles).toHaveLength(oracles)
            expect(
                state.board.oracles.every(
                    (oracle) => !BOARD_GRID.requireSpace(oracle.coords).frontier
                )
            ).toBe(true)
            expect(state.deck).toHaveLength(12)
            expect(state.roundOrder).toHaveLength(count)
            expect(state.activePlayerIds).toEqual([state.roundOrder[0]])
            expect(state.players[0]).toMatchObject({ supplyRoads: 4, stagingRoads: 16 })
        }
    )

    it('uses the red, yellow, gray and blue player colours', () => {
        const state = freshState(4)
        expect(state.players.map((player) => player.color)).toEqual([
            Color.Red,
            Color.Yellow,
            Color.Gray,
            Color.Blue
        ])
    })

    it('reveals the next round’s card until the final round', () => {
        const state = freshState()
        expect(state.upcomingCard()?.id).toBe(state.deck[1])
        state.beginRound(state.roundCount - 1)
        expect(state.upcomingCard()).toBeUndefined()
    })
})

describe('cities', () => {
    it('founds a city on a frontier village with a free market for one point', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G2')
        const action = placeCity(state, 'p0', FRONTIER)
        expect(action.metadata).toMatchObject({ founded: true, foundingMarket: true })
        expect(state.getPlayerState('p0').points).toBe(11)
        expect(state.board.marketOf('p0', cityPlaceId('C1'))).toBeDefined()
        expect(state.cityPlacementPlan('p0', INLAND)).toBeUndefined()
    })

    it('founds on an inland village only when the player has a road into it', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G2')
        placeCity(state, 'p0', FRONTIER)
        placeRoad(state, 'p0', at(FRONTIER, SE), [NW, SE])
        placeRoad(state, 'p0', at(at(FRONTIER, SE), SE), [NW, E])
        giveTurn(state, 'p1', 'G2')
        expect(state.cityPlacementPlan('p1', INLAND)).toBeUndefined()
        giveTurn(state, 'p0', 'G2')
        expect(state.cityPlacementPlan('p0', INLAND)).toMatchObject({ kind: 'Found' })
    })

    it('allows one founding per turn', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G1')
        placeCity(state, 'p0', FRONTIER)
        expect(state.cityPlacementPlan('p0', offsetToAxial({ row: 0, col: 8 }))).toBeUndefined()
    })

    it('requires a tile beside a village to be followed by one on that village', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G1')
        placeCity(state, 'p0', FRONTIER)
        placeRoad(state, 'p0', at(FRONTIER, SE), [NW, SE])
        placeRoad(state, 'p0', at(at(FRONTIER, SE), SE), [NW, E])

        state.turn = newTurn('p0')
        const besideVillage = at(INLAND, NE)
        const first = placeCity(state, 'p0', besideVillage)
        expect(first.metadata).toMatchObject({ founded: true, claimVillage: INLAND })
        expect(state.turn.pendingClaim).toBeDefined()
        expect(state.roadPlacementsRemaining('p0')).toBe(0)
        expect(state.canFinishTurn('p0')).toBe(false)
        expect(state.cityPlacementPlan('p0', at(besideVillage, E))).toBeUndefined()

        const second = placeCity(state, 'p0', INLAND)
        expect(second.metadata).toMatchObject({ foundingMarket: true })
        expect(state.turn.pendingClaim).toBeUndefined()
        expect(state.board.city(first.metadata!.cityId).spaces).toHaveLength(2)
    })

    it('founds on a plain space when further tiles that turn reach a founding village', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G1')
        const start = offsetToAxial({ row: 0, col: 3 })
        const besideVillage = offsetToAxial({ row: 0, col: 2 })
        expect(state.cityPlacementPlan('p0', start)).toMatchObject({
            kind: 'Found',
            awaitsVillage: true
        })

        const first = placeCity(state, 'p0', start)
        expect(first.metadata).toMatchObject({ founded: true, foundingMarket: false })
        expect(state.turn?.pendingFounding).toBe(first.metadata!.cityId)
        expect(state.canFinishTurn('p0')).toBe(false)
        expect(state.roadPlacementsRemaining('p0')).toBe(0)
        expect(state.resupplyAllowance('p0')).toBe(0)
        expect(state.cityPlacementPlan('p0', offsetToAxial({ row: 1, col: 3 }))).toBeUndefined()

        placeCity(state, 'p0', besideVillage)
        expect(state.turn?.pendingFounding).toBeUndefined()
        expect(state.turn?.pendingClaim).toMatchObject({ village: FRONTIER, founding: true })

        const last = placeCity(state, 'p0', FRONTIER)
        expect(last.metadata).toMatchObject({ foundingMarket: true })
        expect(state.turn?.pendingClaim).toBeUndefined()
        expect(state.canFinishTurn('p0')).toBe(true)
        expect(state.board.city(first.metadata!.cityId).spaces).toHaveLength(3)
        expect(state.getPlayerState('p0').points).toBe(9)
    })

    it('does not found on a plain space that cannot reach a founding village this turn', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'Y1')
        expect(state.cityPlacementPlan('p0', offsetToAxial({ row: 0, col: 3 }))).toBeUndefined()
    })

    it('does not start a tile beside a village that could not then be covered', () => {
        const state = freshState()
        state.board.oracles = [{ coords: offsetToAxial({ row: 1, col: 0 }) }]
        giveTurn(state, 'p0', 'G1')
        expect(state.cityPlacementPlan('p0', offsetToAxial({ row: 0, col: 2 }))).toBeUndefined()
    })

    it('never places beside an opponent city or an oracle', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G1')
        placeCity(state, 'p0', FRONTIER)
        giveTurn(state, 'p1', 'G1')
        expect(state.cityPlacementPlan('p1', at(FRONTIER, E))).toBeUndefined()

        state.board.oracles = [{ coords: INLAND }]
        giveTurn(state, 'p0', 'G1')
        expect(state.cityPlacementPlan('p0', at(FRONTIER, E))).toMatchObject({ kind: 'Expand' })
        expect(state.cityPlacementPlan('p0', INLAND)).toBeUndefined()
    })

    it('merges a player’s cities without lifting or un-selling any market', () => {
        const state = freshState()
        state.board.cities = [
            { id: 'C1', playerId: 'p0', spaces: [offsetToAxial({ row: 11, col: 5 })] },
            { id: 'C2', playerId: 'p0', spaces: [offsetToAxial({ row: 11, col: 7 })] }
        ]
        state.board.markets = [
            { playerId: 'p0', placeId: cityPlaceId('C1'), sold: false },
            { playerId: 'p1', placeId: cityPlaceId('C1'), sold: false },
            { playerId: 'p0', placeId: cityPlaceId('C2'), sold: true },
            { playerId: 'p1', placeId: cityPlaceId('C2'), sold: true }
        ]
        const marketsBefore = state.board.marketsRemaining('p1')
        giveTurn(state, 'p0', 'G1')
        const action = placeCity(state, 'p0', offsetToAxial({ row: 11, col: 6 }))
        expect(action.metadata?.mergedCityIds).toEqual(['C2'])
        expect(state.board.cities).toHaveLength(1)
        expect(state.board.marketsAt(cityPlaceId('C1'))).toEqual([
            { playerId: 'p0', placeId: cityPlaceId('C1'), sold: false },
            { playerId: 'p1', placeId: cityPlaceId('C1'), sold: false },
            { playerId: 'p0', placeId: cityPlaceId('C1'), sold: true },
            { playerId: 'p1', placeId: cityPlaceId('C1'), sold: true }
        ])
        expect(state.board.marketsRemaining('p1')).toBe(marketsBefore)
    })
})

describe('roads', () => {
    it('must start from a city, or continue the player’s own road', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G2')
        expect(state.canPlaceRoad('p0', at(FRONTIER, E), [W, E])).toBe(false)
        placeCity(state, 'p0', FRONTIER)
        expect(state.canPlaceRoad('p0', at(FRONTIER, E), [W, E])).toBe(true)
        expect(state.canPlaceRoad('p0', at(FRONTIER, E), [NE, SW])).toBe(false)
        placeRoad(state, 'p0', at(FRONTIER, E), [W, E])
        expect(state.canPlaceRoad('p0', at(at(FRONTIER, E), E), [W, SE])).toBe(true)

        giveTurn(state, 'p1', 'G2')
        expect(state.canPlaceRoad('p1', at(at(FRONTIER, E), E), [W, SE])).toBe(false)
        expect(state.canPlaceRoad('p1', at(FRONTIER, SE), [NW, SE])).toBe(true)
    })

    it('starts from a village or oracle only when the player’s road already reaches it', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'Y2')
        placeCity(state, 'p0', FRONTIER)
        placeRoad(state, 'p0', at(FRONTIER, SE), [NW, SE])
        placeRoad(state, 'p0', at(at(FRONTIER, SE), SE), [NW, E])
        const beyondVillage = at(INLAND, E)
        expect(state.canPlaceRoad('p0', beyondVillage, [W, E])).toBe(true)
        giveTurn(state, 'p1', 'Y2')
        expect(state.canPlaceRoad('p1', beyondVillage, [W, E])).toBe(false)
    })
})

describe('action allowance', () => {
    it('allows two basic actions or one enhanced action', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G2')
        state.getPlayerState('p0').supplyRoads = 10
        expect(state.roadPlacementsRemaining('p0')).toBe(3)
        expect(state.cityPlacementsRemaining('p0')).toBe(3)
        expect(state.resupplyAllowance('p0')).toBe(7)

        placeCity(state, 'p0', FRONTIER)
        expect(state.roadPlacementsRemaining('p0')).toBe(2)
        expect(state.resupplyAllowance('p0')).toBe(5)

        placeRoad(state, 'p0', at(FRONTIER, E), [W, E])
        expect(state.resupplyAllowance('p0')).toBe(0)
        expect(state.cityPlacementsRemaining('p0')).toBe(1)
    })

    it('resupplies last, moving tiles from staging to supply', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G2')
        const resupply = new HydratedResupply({
            ...base('p0'),
            type: ActionType.Resupply,
            roads: 4,
            cities: 3
        })
        resupply.apply(state)
        expect(state.getPlayerState('p0')).toMatchObject({ supplyRoads: 8, supplyCities: 7 })
        expect(state.roadPlacementsRemaining('p0')).toBe(0)
        expect(state.cityPlacementsRemaining('p0')).toBe(0)
    })
})

describe('network, markets and oracles', () => {
    const row = (col: number) => offsetToAxial({ row: 1, col })

    function oracleLine(): HydratedMagnaGreciaGameState {
        const state = freshState()
        state.board.oracles = [{ coords: row(5) }]
        state.board.cities = [
            { id: 'C1', playerId: 'p0', spaces: [row(3)] },
            { id: 'C2', playerId: 'p1', spaces: [row(7)] },
            { id: 'C3', playerId: 'p2', spaces: [row(9)] }
        ]
        state.board.roads = [{ playerId: 'p0', coords: row(4), ends: [W, E] }]
        return state
    }

    it('turns the oracle only toward a strictly more important city', () => {
        const state = oracleLine()
        const board = state.board
        expect(board.updateOracleAttention(board.network())).toHaveLength(1)
        expect(board.oracles[0].attentionCityId).toBe('C1')

        board.roads.push({ playerId: 'p1', coords: row(6), ends: [W, E] })
        expect(board.updateOracleAttention(board.network())).toHaveLength(0)

        board.roads.push({ playerId: 'p2', coords: row(8), ends: [W, E] })
        expect(board.updateOracleAttention(board.network())).toEqual([
            { oracle: row(5), fromCityId: 'C1', toCityId: 'C2' }
        ])
        expect(state.scores().p1.oracles).toBe(4)
    })

    it('counts distinct directly connected places and ignores dead ends', () => {
        const state = oracleLine()
        state.board.roads.push(
            { playerId: 'p1', coords: row(6), ends: [W, E] },
            { playerId: 'p1', coords: row(8), ends: [W, SE] }
        )
        const network = state.board.network()
        expect(network.connectionCount(cityPlaceId('C2'))).toBe(1)
        expect(network.connectionCount(cityPlaceId('C3'))).toBe(0)
    })

    it('prices, activates, values and sells markets', () => {
        const state = oracleLine()
        const board = state.board
        board.roads.push({ playerId: 'p1', coords: row(6), ends: [W, E] })
        board.markets = [
            { playerId: 'p0', placeId: cityPlaceId('C1'), sold: false },
            { playerId: 'p2', placeId: cityPlaceId('C2'), sold: false },
            { playerId: 'p1', placeId: cityPlaceId('C2'), sold: true }
        ]
        const c2 = board.place(cityPlaceId('C2'))!
        expect(marketCost(board, 'p0', c2)).toBe(2)

        giveTurn(state, 'p0', 'G2')
        const build = new HydratedBuildMarket({
            ...base('p0'),
            type: ActionType.BuildMarket,
            placeId: cityPlaceId('C2')
        })
        build.apply(state)
        expect(build.metadata).toEqual({ cost: 2 })
        const network = board.network()
        const p0InC2 = board.marketOf('p0', cityPlaceId('C2'))!
        expect(marketValue(board, network, p0InC2)).toBe(0)
        expect(marketValue(board, network, board.marketOf('p0', cityPlaceId('C1'))!)).toBe(1)

        giveTurn(state, 'p0', 'G2')
        const sell = new HydratedSellMarket({
            ...base('p0'),
            type: ActionType.SellMarket,
            placeId: cityPlaceId('C1')
        })
        const pointsBefore = state.getPlayerState('p0').points
        sell.apply(state)
        expect(state.getPlayerState('p0').points).toBe(pointsBefore + 1)
        expect(state.sellableMarkets('p0')).toHaveLength(0)
    })

    it('never lets a player build in their own city or twice in one place', () => {
        const state = oracleLine()
        giveTurn(state, 'p0', 'G2')
        const sites = state.marketSites('p0').map((place) => place.id)
        expect(sites).not.toContain(cityPlaceId('C1'))
        expect(sites).toContain(villagePlaceId(FRONTIER))
        state.board.markets.push({ playerId: 'p0', placeId: villagePlaceId(FRONTIER), sold: true })
        expect(state.marketSites('p0').map((place) => place.id)).not.toContain(
            villagePlaceId(FRONTIER)
        )
    })

    it('does not end a turn while a village claim is pending', () => {
        const state = freshState()
        giveTurn(state, 'p0', 'G2')
        state.turn!.pendingClaim = { village: INLAND, cityId: 'C1', founding: false }
        expect(HydratedEndTurn.canEndTurn(state, 'p0')).toBe(false)
    })
})
