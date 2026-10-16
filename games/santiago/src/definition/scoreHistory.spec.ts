import { GameEngine, PlayerStatus, Visibility, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import { SantiagoRuntime } from './runtime.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import type { SantiagoProjectedState } from '../model/gameState.js'
import { calculateScores } from '../util/scoring.js'
import { roundScoreHistory } from '../util/scoreHistory.js'
import { isEndRoundEvent } from '../actions/endRoundEvent.js'
import { nextAction } from './tests/autoplay.js'

const engine = new GameEngine(SantiagoRuntime)

function playToEnd(publicMoney: boolean) {
    const game = SantiagoRuntime.initializer.initializeGame(
        {
            id: 'santiago-score-history',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { publicMoney },
            players: Array.from({ length: 4 }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, {
        masterSeed: 'fedcba9876543210fedcba9876543210'
    })
    let state: SantiagoProjectedState = initialState
    const actions: GameAction[] = []
    const scoresAtRoundEnds: Record<string, number>[] = []
    while (state.machineState !== MachineState.EndOfGame) {
        const action = nextAction(state, game.id)
        const seat = state.seatOrder.indexOf(action.playerId)
        const money =
            state.players.find((player) => player.playerId === action.playerId)?.money ?? 0
        const chosen =
            action.type === ActionType.PlaceBid
                ? { ...action, amount: seat <= money ? seat : 0 }
                : action
        const result = engine.executeCanonicalAction({ game: startedGame, state, action: chosen })
        state = result.updatedState
        actions.push(...result.processedActions)
        if (result.processedActions.some(isEndRoundEvent)) {
            const plantations = calculateScores(SantiagoRuntime.hydrator.hydrateState(state).board)
            scoresAtRoundEnds.push(
                Object.fromEntries(
                    state.players.map((player) => [
                        player.playerId,
                        (plantations[player.playerId] ?? 0) + (player.money ?? Number.NaN)
                    ])
                )
            )
        }
    }
    return { game: startedGame, state, actions, scoresAtRoundEnds }
}

function spectatorHistory({ game, state, actions }: ReturnType<typeof playToEnd>) {
    return Visibility.projectActionHistory({
        currentState: state,
        actions,
        visibility: SantiagoRuntime.visibility,
        perspective: { kind: 'spectator' },
        replay: { game, runtime: SantiagoRuntime }
    })
}

describe('roundScoreHistory', () => {
    it('scores every round as it stood when the round ended, ending at the final score', () => {
        const played = playToEnd(true)
        const history = roundScoreHistory(played.state, played.actions)

        expect(history).toEqual(
            played.state.players.map(({ playerId }) => ({
                playerId,
                scores: played.scoresAtRoundEnds.map((round) => round[playerId])
            }))
        )
        expect(history?.[0].scores).toHaveLength(played.state.round)
        for (const { playerId, scores } of history ?? []) {
            expect(scores.at(-1)).toBe(
                played.state.players.find((player) => player.playerId === playerId)?.score
            )
        }
    })

    it('rebuilds the same history from a spectator view of a public-money game', () => {
        const played = playToEnd(true)
        const projected = spectatorHistory(played)
        const canonical = roundScoreHistory(played.state, played.actions)
        expect(canonical).toBeDefined()
        expect(roundScoreHistory(projected.currentState, projected.actions)).toEqual(canonical)
    })

    it('has no history when earlier balances are hidden', () => {
        const projected = spectatorHistory(playToEnd(false))
        expect(roundScoreHistory(projected.currentState, projected.actions)).toBeUndefined()
    })
})
