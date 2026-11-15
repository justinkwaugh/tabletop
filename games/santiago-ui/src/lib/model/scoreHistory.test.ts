import { GameEngine, PlayerStatus, Visibility, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    ActionType,
    Definition,
    MachineState,
    SantiagoRuntime,
    calculateScores,
    isEndRoundEvent,
    type SantiagoProjectedState
} from '@tabletop/santiago'
import { nextAction } from '@tabletop/santiago/testing'
import { roundScoresFromHistory } from './scoreHistory.js'

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

function projectedHistory(
    { game, state, actions }: ReturnType<typeof playToEnd>,
    perspective: Visibility.Perspective = { kind: 'spectator' }
) {
    return Visibility.projectActionHistory({
        currentState: state,
        actions,
        visibility: SantiagoRuntime.visibility,
        perspective,
        replay: { game, runtime: SantiagoRuntime }
    })
}

describe('roundScoresFromHistory', () => {
    it('scores every round as it stood when the round ended, ending at the final score', () => {
        const played = playToEnd(true)
        const history = roundScoresFromHistory(played.state, played.actions)

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
        const projected = projectedHistory(played)
        const canonical = roundScoresFromHistory(played.state, played.actions)
        expect(canonical).toBeDefined()
        expect(roundScoresFromHistory(projected.currentState, projected.actions)).toEqual(canonical)
    })

    it.each<Visibility.Perspective>([{ kind: 'spectator' }, { kind: 'player', playerId: 'p0' }])(
        'has no history when earlier balances are hidden from %o',
        (perspective) => {
            const projected = projectedHistory(playToEnd(false), perspective)
            expect(
                roundScoresFromHistory(projected.currentState, projected.actions)
            ).toBeUndefined()
        }
    )

    it('has no history when the earliest rounds were redacted', () => {
        const played = playToEnd(true)
        const roundEnds = played.actions.flatMap((action, index) =>
            isEndRoundEvent(action) ? [index] : []
        )
        const redactedThrough = roundEnds[1]
        const actions = played.actions.map((action, index) =>
            index <= redactedThrough
                ? {
                      id: action.id,
                      gameId: action.gameId,
                      source: action.source,
                      type: Visibility.RedactedActionType
                  }
                : action
        )
        expect(roundScoresFromHistory(played.state, actions)).toBeUndefined()
    })
})
