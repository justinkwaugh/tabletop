import {
    ActionSource,
    defaultGameConfig,
    GameResult,
    validateGameResult,
    GameEngine,
    MachineContext,
    PlayerStatus
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './definition.js'
import { UrbinoRuntime } from './runtime.js'
import { UrbinoScoring } from './scoring.js'
import { UrbinoInfo } from './info.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import type { PlaceArchitect } from '../actions/placeArchitect.js'
import type { ChooseFirstPlayer } from '../actions/chooseFirstPlayer.js'
import type { PlaceBuilding } from '../actions/placeBuilding.js'
import type { RepositionArchitect } from '../actions/repositionArchitect.js'
import type { Pass } from '../actions/pass.js'
import type { Concede } from '../actions/concede.js'
import type { UrbinoGameState } from '../model/gameState.js'
import { BuildingType } from '../components/building.js'
import {
    BOARD_SQUARES,
    computeDistrictScores,
    getValidPlacementsForType,
    hasAnyValidPlacement
} from '../logic/board.js'

const engine = new GameEngine(UrbinoRuntime)
const scoring = new UrbinoScoring()
function createGame() {
    return UrbinoRuntime.initializer.initializeGame(
        {
            id: 'urbino-competition',
            typeId: 'urbino',
            ownerId: 'owner',
            seed: 101,
            config: defaultGameConfig(UrbinoInfo.configurator?.options ?? []),
            players: ['p0', 'p1'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

type UrbinoGame = ReturnType<typeof createGame>

function seededChooser(seed: number) {
    let value = seed
    return <T>(options: T[]): T => {
        value = (value * 1103515245 + 12345) % 2147483648
        return options[value % options.length]
    }
}

function startPlaying(game: UrbinoGame, choose: ReturnType<typeof seededChooser>) {
    let state = engine.startGame(game, {
        startingPositions: { playerIds: ['p1', 'p0'] }
    }).initialState
    for (const [index, position] of [30, 50].entries()) {
        const action: PlaceArchitect = {
            id: `architect-${index}`,
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.PlaceArchitect,
            playerId: state.activePlayerIds[0],
            position
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    const chooseFirst: ChooseFirstPlayer = {
        id: 'choose-first',
        gameId: game.id,
        source: ActionSource.User,
        type: ActionType.ChooseFirstPlayer,
        playerId: state.activePlayerIds[0],
        startingPlayerId: choose(['p0', 'p1'])
    }
    return engine.executeCanonicalAction({ game, state, action: chooseFirst }).updatedState
}

function remainingBuildingTypes(state: UrbinoGameState, playerId: string): BuildingType[] {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    if (!player) {
        throw Error(`Missing player ${playerId}`)
    }
    return [
        ...(player.houses > 0 ? [BuildingType.House] : []),
        ...(player.palaces > 0 ? [BuildingType.Palace] : []),
        ...(player.towers > 0 ? [BuildingType.Tower] : [])
    ]
}

function placementsFor(state: UrbinoGameState, playerId: string, architects: number[]) {
    return remainingBuildingTypes(state, playerId).flatMap((buildingType) =>
        getValidPlacementsForType(
            state.board,
            architects,
            playerId,
            buildingType,
            state.monumentsVariant
        ).map((position) => ({ buildingType, position }))
    )
}

function repositionsFor(state: UrbinoGameState, playerId: string) {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    if (!player || state.hasRepositionedThisTurn) {
        return []
    }
    return [0, 1].flatMap((architectIndex) =>
        Array.from({ length: BOARD_SQUARES }, (_, position) => position)
            .filter((position) => {
                if (state.board[position] !== null || state.architects.includes(position)) {
                    return false
                }
                const architects = [...state.architects]
                architects[architectIndex] = position
                return hasAnyValidPlacement(
                    state.board,
                    architects,
                    playerId,
                    player,
                    state.monumentsVariant
                )
            })
            .map((position) => ({ architectIndex, position }))
    )
}

function nextTurnAction(
    game: UrbinoGame,
    state: UrbinoGameState,
    choose: ReturnType<typeof seededChooser>,
    id: string
): PlaceBuilding | RepositionArchitect | Pass {
    const playerId = state.activePlayerIds[0]
    const base = { id, gameId: game.id, source: ActionSource.User, playerId }
    const placements = placementsFor(state, playerId, state.architects)
    const repositions = repositionsFor(state, playerId)
    if (repositions.length > 0 && (placements.length === 0 || choose([false, false, true]))) {
        return { ...base, type: ActionType.RepositionArchitect, ...choose(repositions) }
    }
    if (placements.length > 0) {
        return { ...base, type: ActionType.PlaceBuilding, ...choose(placements) }
    }
    return { ...base, type: ActionType.Pass }
}

function playToEnd(game: UrbinoGame, seed: number) {
    const choose = seededChooser(seed)
    let state = startPlaying(game, choose)
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        const action = nextTurnAction(game, state, choose, `turn-${step}`)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

function expectWinnersHoldMaximumFinalScore(state: UrbinoGameState) {
    const finalScores = scoring.finalScores(state)
    expect(Object.keys(finalScores).toSorted()).toEqual(['p0', 'p1'])
    expect(finalScores).toEqual(
        Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    )
    const maximum = Math.max(...Object.values(finalScores))
    expect(state.winningPlayerIds.toSorted()).toEqual(
        Object.keys(finalScores)
            .filter((playerId) => finalScores[playerId] === maximum)
            .toSorted()
    )
}

describe('Urbino competition', () => {
    it.each([
        ['p0', 'p1'],
        ['p1', 'p0']
    ])(
        'assigns architect placement and preserves the first position’s choice: %s, %s',
        (first, second) => {
            const game = createGame()
            let state = engine.startGame(game, {
                startingPositions: {
                    playerIds: [first, second]
                }
            }).initialState
            expect(state.turnManager.turnOrder).toEqual([first, second])
            expect(state.players.map((player) => player.playerId)).toEqual([first, second])
            expect(state.activePlayerIds).toEqual([first])
            for (const [index, playerId] of [first, second].entries()) {
                expect(state.activePlayerIds).toEqual([playerId])
                const action: PlaceArchitect = {
                    id: `architect-${index}`,
                    gameId: game.id,
                    source: ActionSource.User,
                    type: ActionType.PlaceArchitect,
                    playerId,
                    position: index
                }
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.machineState).toBe(MachineState.ChoosingFirstPlayer)
            expect(state.activePlayerIds).toEqual([first])
            const action: ChooseFirstPlayer = {
                id: 'choose-first',
                gameId: game.id,
                source: ActionSource.User,
                type: ActionType.ChooseFirstPlayer,
                playerId: first,
                startingPlayerId: second
            }
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
            expect(state.activePlayerIds).toEqual([second])
            expect(state.turnManager.series[0].playerId).toBe(second)
        }
    )

    it('preserves seeded ordinary setup, player identity, and colors', () => {
        const game = createGame()
        const uninitialized = engine.generateUninitializedState(game)
        const normal = UrbinoRuntime.initializer
            .initializeGameState(game, structuredClone(uninitialized))
            .dehydrate()
        const assigned = UrbinoRuntime.initializer
            .initializeGameState(game, structuredClone(uninitialized), {
                playerIds: normal.turnManager.turnOrder
            })
            .dehydrate()
        expect(assigned).toEqual(normal)
        const reversedIds = [...normal.turnManager.turnOrder].reverse()
        const reversed = UrbinoRuntime.initializer
            .initializeGameState(game, structuredClone(uninitialized), { playerIds: reversedIds })
            .dehydrate()
        expect(
            reversed.players.map((player) => [player.playerId, player.color]).toSorted()
        ).toEqual(normal.players.map((player) => [player.playerId, player.color]).toSorted())
        expect(
            UrbinoRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), {
                    playerIds: reversedIds
                })
                .dehydrate()
        ).toEqual(reversed)
        expect(reversed.prng).toEqual(normal.prng)
    })

    it.each([false, true])('extracts declared terminal winners with a tied score: %s', (tied) => {
        const game = createGame()
        const state = UrbinoRuntime.hydrator.hydrateState(
            engine.startGame(game, { startingPositions: { playerIds: ['p1', 'p0'] } }).initialState
        )
        state.players[0].score = 10
        state.players[1].score = tied ? 10 : 4
        state.machineState = MachineState.EndOfGame
        UrbinoRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: game.config })
        )
        expect(state.winningPlayerIds).toEqual(tied ? ['p1', 'p0'] : ['p1'])
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
    })

    it('reports every final score from games finished by the terminal handler', () => {
        const game = createGame()
        expect(UrbinoRuntime.scoring).toBeInstanceOf(UrbinoScoring)
        const finishedGames = [1, 2, 3, 58, 75].map((seed) => playToEnd(game, seed))
        for (const state of finishedGames) {
            expect(state.result).toBe(GameResult.Win)
            expect(state.concededByPlayerId).toBeUndefined()
            expect(() => validateGameResult(state)).not.toThrow()
            expect(Object.values(scoring.finalScores(state)).some((score) => score > 0)).toBe(true)
            expectWinnersHoldMaximumFinalScore(state)
        }
        expect(finishedGames.map((state) => state.winningPlayerIds.length)).toEqual([1, 1, 1, 2, 2])
    })

    it('reports final scores after a concession', () => {
        const game = createGame()
        const choose = seededChooser(3)
        let state = startPlaying(game, choose)
        for (let step = 0; ; step++) {
            const scores = computeDistrictScores(state.board, state.monumentsVariant)
            const trailing = state.players.find((player) =>
                state.players.some(
                    (other) =>
                        (scores.get(other.playerId) ?? 0) > (scores.get(player.playerId) ?? 0)
                )
            )
            if (trailing && state.activePlayerIds[0] === trailing.playerId) {
                const concede: Concede = {
                    id: 'concede',
                    gameId: game.id,
                    source: ActionSource.User,
                    type: ActionType.Concede,
                    playerId: trailing.playerId
                }
                state = engine.executeCanonicalAction({ game, state, action: concede }).updatedState
                break
            }
            const action = nextTurnAction(game, state, choose, `turn-${step}`)
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
        }
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.concededByPlayerId).toBeDefined()
        expect(state.winningPlayerIds).not.toContain(state.concededByPlayerId)
        expectWinnersHoldMaximumFinalScore(state)
    })
})
