import {
    ActionSource,
    assertExists,
    defaultGameConfig,
    GameEngine,
    GameResult,
    PlayerStatus,
    validateGameResult,
    type Game
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { HydratedBeginJourney, type BeginJourney } from '../actions/beginJourney.js'
import type { Pass } from '../actions/pass.js'
import { HydratedPlaceMaster, type PlaceMaster } from '../actions/placeMaster.js'
import { HydratedRecruitStudents, type RecruitStudents } from '../actions/recruitStudents.js'
import type { Placement } from '../components/gameBoard.js'
import type { BridgesGameState, HydratedBridgesGameState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Definition } from './gameDefinition.js'
import { BridgesInfo } from './info.js'
import { MasterType } from './masterType.js'
import { BridgesRuntime } from './runtime.js'
import { MachineState } from './states.js'

type BridgesAction = PlaceMaster | RecruitStudents | BeginJourney | Pass

const engine = new GameEngine(BridgesRuntime)
const maxActions = 2000

function createGame(count: number) {
    return BridgesRuntime.initializer.initializeGame(
        {
            id: 'bridges-competition',
            typeId: BridgesInfo.id,
            ownerId: 'owner',
            seed: 101,
            config: defaultGameConfig(BridgesInfo.configurator?.options ?? []),
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

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function placements(state: HydratedBridgesGameState): Placement[] {
    return state.board.villages.flatMap((_, village) =>
        Object.values(MasterType).map((masterType) => ({ masterType, village }))
    )
}

function journey(state: HydratedBridgesGameState, playerId: string) {
    for (const [from, village] of state.board.villages.entries()) {
        if (!HydratedBeginJourney.isValidSourceVillage(state, playerId, from).valid) continue
        const to = village.neighbors.find(
            (neighbor) =>
                HydratedBeginJourney.isValidDestinationVillage(state, neighbor, from).valid
        )
        if (to !== undefined) return { from, to }
    }
    return undefined
}

function recruitment(state: HydratedBridgesGameState, playerId: string) {
    if (state.turnManager.turnCount(playerId) < 7) return undefined
    return placements(state).find(
        (placement) => HydratedRecruitStudents.isValidPlacement(state, playerId, placement).valid
    )
}

function masterPlacement(state: HydratedBridgesGameState, playerId: string) {
    return placements(state).find(
        (placement) => HydratedPlaceMaster.isValidPlacement(state, playerId, placement).valid
    )
}

function chooseAction(state: HydratedBridgesGameState, index: number): BridgesAction {
    const playerId = state.activePlayerIds[0]
    assertExists(playerId, 'Expected an active player')
    const base = {
        id: `action-${index}`,
        gameId: state.gameId,
        source: ActionSource.User,
        playerId
    }
    const recruit = recruitment(state, playerId)
    if (state.machineState === MachineState.RecruitingStudents) {
        return recruit
            ? { ...base, type: ActionType.RecruitStudents, placement: recruit }
            : { ...base, type: ActionType.Pass }
    }
    const route = state.turnManager.turnCount(playerId) >= 7 ? journey(state, playerId) : undefined
    if (route) return { ...base, type: ActionType.BeginJourney, ...route }
    if (recruit) return { ...base, type: ActionType.RecruitStudents, placement: recruit }
    const placement = masterPlacement(state, playerId)
    if (placement) return { ...base, type: ActionType.PlaceMaster, placement }
    return { ...base, type: ActionType.Pass }
}

function playToEnd(game: Game, initialState: BridgesGameState): BridgesGameState {
    let state = initialState
    for (let index = 0; state.machineState !== MachineState.EndOfGame; index++) {
        expect(index).toBeLessThan(maxActions)
        const action = chooseAction(BridgesRuntime.hydrator.hydrateState(state), index)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

describe.each([3, 4])('Bridges of Shangri-La tournaments with %i players', (count) => {
    it('honors every starting seat through the first round of turns', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState, startedGame } = engine.startGame(game, {
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.turnManager.series[0].playerId).toBe(order[0])
            expect(startedGame.startedAt).toBeDefined()
            let state = initialState
            for (const [index, playerId] of order.entries()) {
                expect(state.activePlayerIds).toEqual([playerId])
                const action = chooseAction(BridgesRuntime.hydrator.hydrateState(state), index)
                expect(action.type).toBe(ActionType.PlaceMaster)
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.activePlayerIds).toEqual([order[0]])
        }
    })

    it('preserves ordinary seeded setup, colors and later random draws', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game)
        const initialize = (playerIds?: string[]) =>
            BridgesRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            expect(assigned.players.map((player) => [player.playerId, player.color])).toEqual(
                normal.players.map((player) => [player.playerId, player.color])
            )
            expect(assigned.prng).toEqual(normal.prng)
        }
    })

    it('reproduces assigned setup deterministically', () => {
        const game = createGame(count)
        const playerIds = game.players.map((player) => player.id).reverse()
        const start = () =>
            engine.startGame(game, { startingPositions: { playerIds } }).initialState
        const first = start()
        expect({ ...start(), id: first.id, protectedPrng: first.protectedPrng }).toEqual(first)
    })

    it.each(rotations(Array.from({ length: count }, (_, index) => `p${index}`)))(
        'declares winners and final scores from a finished game starting with %s',
        (...order) => {
            const game = createGame(count)
            const finished = playToEnd(
                game,
                engine.startGame(game, { startingPositions: { playerIds: order } }).initialState
            )
            expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
            expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
            expect(finished.result === GameResult.Draw).toBe(finished.winningPlayerIds.length > 1)
            expect(() => validateGameResult(finished)).not.toThrow()

            const hydrated = BridgesRuntime.hydrator.hydrateState(finished)
            const finalScores = BridgesRuntime.scoring?.finalScores(finished)
            expect(finalScores).toEqual(
                Object.fromEntries(
                    order
                        .toSorted()
                        .map((playerId) => [playerId, hydrated.board.numMastersForPlayer(playerId)])
                )
            )
            assertExists(finalScores, 'Expected final scores')
            const best = Math.max(...Object.values(finalScores))
            for (const playerId of finished.winningPlayerIds) {
                expect(finalScores[playerId]).toBe(best)
            }
        }
    )
})
