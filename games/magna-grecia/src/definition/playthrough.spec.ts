import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameResult,
    PlayerStatus,
    assert,
    assertExists,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import { BOARD_GRID } from '../components/boardGrid.js'
import { marketCost } from '../model/marketRules.js'
import type {
    HydratedMagnaGreciaGameState,
    MagnaGreciaProjectedState
} from '../model/gameState.js'
import { legalRoadEnds } from '../model/roadRules.js'
import { ActionType } from './actions.js'
import { GameLength } from './config.js'
import { Definition } from './definition.js'
import { MagnaGreciaRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { SeededEngine } from './testEngine.js'

const engine = new SeededEngine(97)
const spaces = [...BOARD_GRID]

function createGame(count: number, gameLength: GameLength) {
    return MagnaGreciaRuntime.initializer.initializeGame(
        {
            id: 'magna-grecia-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 97,
            config: { gameLength },
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

function rotated<T>(items: T[], offset: number): T[] {
    const start = offset % items.length
    return [...items.slice(start), ...items.slice(0, start)]
}

function act<T extends GameAction>(action: T): GameAction {
    return action
}

function botAction(
    state: HydratedMagnaGreciaGameState,
    playerId: string,
    step: number
): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const player = state.getPlayerState(playerId)
    const claim = state.turn?.pendingClaim
    if (claim) {
        return act({ ...base, type: ActionType.PlaceCity, coords: claim.village })
    }

    if (state.turn?.pendingFounding) {
        const next = spaces.find(
            (space) => state.cityPlacementPlan(playerId, space.coords) !== undefined
        )
        assertExists(next, 'A pending founding must have a legal next tile')
        return act({ ...base, type: ActionType.PlaceCity, coords: next.coords })
    }

    if (state.cityPlacementsRemaining(playerId) > 0 && player.points > 4) {
        const city = rotated(spaces, step).find(
            (space) => state.cityPlacementPlan(playerId, space.coords) !== undefined
        )
        if (city) {
            return act({ ...base, type: ActionType.PlaceCity, coords: city.coords })
        }
    }

    if (state.roadPlacementsRemaining(playerId) > 0) {
        for (const space of rotated(spaces, step * 7)) {
            const ends = legalRoadEnds(state.board, playerId, space.coords)[step % 3]
            if (ends) {
                return act({ ...base, type: ActionType.PlaceRoad, coords: space.coords, ends })
            }
        }
    }

    const resupply = state.resupplyAllowance(playerId)
    if (resupply > 0) {
        const roads = Math.min(player.stagingRoads, Math.ceil(resupply / 2))
        const cities = Math.min(player.stagingCities, resupply - roads)
        if (roads + cities > 0) {
            return act({ ...base, type: ActionType.Resupply, roads, cities })
        }
    }

    const sellable = state.sellableMarkets(playerId)
    if (player.points < 3 && sellable.length > 0) {
        return act({ ...base, type: ActionType.SellMarket, placeId: sellable[0].placeId })
    }

    const site = state
        .marketSites(playerId)
        .toSorted(
            (a, b) => marketCost(state.board, playerId, a) - marketCost(state.board, playerId, b)
        )[0]
    if (site && player.points > 6) {
        return act({ ...base, type: ActionType.BuildMarket, placeId: site.id })
    }

    return act({ ...base, type: ActionType.EndTurn })
}

function playToEnd(count: number, gameLength: GameLength): MagnaGreciaProjectedState {
    const game = createGame(count, gameLength)
    let state = engine.startGame(game).initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(MagnaGreciaRuntime.hydrator.hydrateState(state), playerId, step)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

describe.each([2, 3, 4])('a %i player game', (count) => {
    it.each([
        [GameLength.Full, 12],
        [GameLength.Short, 8]
    ])('plays %s length to a declared result', (gameLength, rounds) => {
        const finished = playToEnd(count, gameLength)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(finished.roundCount).toBe(rounds)
        expect(finished.round).toBe(rounds - 1)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(finished.board.cities.length).toBeGreaterThan(0)
        expect(finished.board.roads.length).toBeGreaterThan(0)

        const scoring = MagnaGreciaRuntime.scoring
        assertExists(scoring, 'Magna Grecia declares final scores')
        const scores = scoring.finalScores(finished)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const again = playToEnd(count, gameLength)
        expect({ ...again, id: finished.id }).toEqual(finished)
    })
})
