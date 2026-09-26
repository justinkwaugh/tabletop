import {
    GameEngine,
    GameResult,
    PlayerStatus,
    assert,
    assertExists,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import { SantiagoRuntime } from './runtime.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { SantiagoGameStateValidator, type SantiagoProjectedState } from '../model/gameState.js'
import { calculateScores } from '../util/scoring.js'
import { nextAction } from './tests/autoplay.js'

const engine = new GameEngine(SantiagoRuntime)

function playToEnd(
    count: number,
    masterSeed: string,
    bid: (seat: number, money: number) => number
) {
    const game = SantiagoRuntime.initializer.initializeGame(
        {
            id: 'santiago-scoring',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { publicMoney: false },
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, { masterSeed })
    let state: SantiagoProjectedState = initialState
    for (let step = 0; step < 400 && state.machineState !== MachineState.EndOfGame; step++) {
        const action = nextAction(state, game.id)
        const chosen =
            action.type === ActionType.PlaceBid
                ? { ...action, amount: bidFor(state, action.playerId, bid) }
                : action
        state = engine.executeCanonicalAction({
            game: startedGame,
            state,
            action: chosen
        }).updatedState
    }
    assert(SantiagoGameStateValidator.Check(state), 'Expected canonical state')
    return state
}

function bidFor(
    state: SantiagoProjectedState,
    playerId: string,
    bid: (seat: number, money: number) => number
) {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    assertExists(player?.money, 'Canonical state exposes money')
    return bid(state.seatOrder.indexOf(playerId), player.money)
}

describe.each([3, 4, 5])('Santiago final scores with %i players', (count) => {
    it.each([
        ['0123456789abcdef0123456789abcdef', () => 0],
        [
            'fedcba9876543210fedcba9876543210',
            (seat: number, money: number) => (seat <= money ? seat : 0)
        ]
    ])('match the terminal result for seed %s', (masterSeed, bid) => {
        const state = playToEnd(count, masterSeed, bid)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(() => validateGameResult(state)).not.toThrow()

        const finalScores = SantiagoRuntime.scoring.finalScores(state)
        const plantationScores = calculateScores(SantiagoRuntime.hydrator.hydrateState(state).board)
        expect(finalScores).toEqual(
            Object.fromEntries(
                state.players.map((player) => [
                    player.playerId,
                    (plantationScores[player.playerId] ?? 0) + (player.money ?? Number.NaN)
                ])
            )
        )
        const best = Math.max(...Object.values(finalScores))
        const leaders = Object.keys(finalScores).filter(
            (playerId) => finalScores[playerId] === best
        )
        expect(state.winningPlayerIds).toEqual(leaders)
        expect(state.result).toBe(leaders.length > 1 ? GameResult.Draw : GameResult.Win)
    })
})

it('shares a tied final score as a draw', () => {
    const state = playToEnd(4, '0123456789abcdef0123456789abcdef', () => 0)
    expect(SantiagoRuntime.scoring.finalScores(state)).toEqual({ p0: 42, p1: 47, p2: 42, p3: 47 })
    expect(state.result).toBe(GameResult.Draw)
    expect(state.winningPlayerIds).toEqual(['p1', 'p3'])
})
