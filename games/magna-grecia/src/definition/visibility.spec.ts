import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    Visibility,
    assertExists,
    getPrng,
    type Game
} from '@tabletop/common'
import { actionCard } from '../components/actionCards.js'
import {
    MagnaGreciaGameStateValidator,
    MagnaGreciaProjectedStateValidator,
    type MagnaGreciaGameState,
    type MagnaGreciaProjectedState
} from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { sampleDeck } from './exploration.js'
import { MagnaGreciaRuntime } from './runtime.js'

const spectator = { kind: 'spectator' } as const

const engine = new GameEngine(MagnaGreciaRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(): Game {
    return MagnaGreciaRuntime.initializer.initializeGame(
        {
            id: 'magna-grecia-visibility',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: {},
            players: ['p0', 'p1', 'p2'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function canonical(state: MagnaGreciaProjectedState): MagnaGreciaGameState {
    if (!MagnaGreciaGameStateValidator.Check(state)) {
        throw new Error('Expected complete canonical state')
    }
    return state
}

function endTurn(game: Game, state: MagnaGreciaProjectedState) {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, 'Expected an acting player')
    return engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: `end-${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: ActionType.EndTurn
        }
    })
}

function thrownBy(run: () => unknown): unknown {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

function layersHoldEveryColour(deck: readonly string[]): boolean {
    return [0, 1, 2].every(
        (layer) =>
            new Set(deck.slice(layer * 4, layer * 4 + 4).map((id) => actionCard(id).border))
                .size === 4
    )
}

describe('Magna Grecia visibility', () => {
    it('shuffles the deck from the protected stream so the public seed cannot rebuild it', () => {
        const game = createGame()
        const first = engine.startGame(game, { masterSeed }).initialState
        const again = engine.startGame(game, { masterSeed }).initialState
        const otherSeed = engine.startGame(game, {
            masterSeed: 'fedcba9876543210fedcba9876543210'
        }).initialState
        expect(again.deck).toEqual(first.deck)
        expect(first.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        expect(otherSeed.deck).not.toEqual(first.deck)
        const projected = MagnaGreciaRuntime.visibility.state.project(canonical(first), spectator, {
            config: game.config
        })
        expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        expect(projected).not.toHaveProperty('masterSeed')
    })

    it('shows only the played, current and upcoming cards', () => {
        const game = createGame()
        const { initialState } = engine.startGame(game, { masterSeed })
        const perspectives = [spectator, { kind: 'player', playerId: 'p0' } as const]
        for (const perspective of perspectives) {
            const projected = MagnaGreciaRuntime.visibility.state.project(
                canonical(initialState),
                perspective,
                { config: game.config }
            )
            expect(projected).not.toHaveProperty('deck')
            expect(projected.revealedCardIds).toEqual(initialState.deck?.slice(0, 2))
            expect(MagnaGreciaProjectedStateValidator.Check(projected)).toBe(true)
            const hydrated = MagnaGreciaRuntime.hydrator.hydrateState(projected)
            expect(hydrated.currentCard().id).toBe(initialState.deck?.[0])
            expect(hydrated.upcomingCard()?.id).toBe(initialState.deck?.[1])
        }
    })

    it('marks the turn that reveals the next card as information-revealing', () => {
        const game = createGame()
        let state = engine.startGame(game, { masterSeed }).initialState
        const players = state.turnManager.turnOrder.length
        for (let turn = 0; turn < players - 1; turn++) {
            const result = endTurn(game, state)
            expect(result.processedActions[0].revealsInfo).toBeUndefined()
            state = result.updatedState
        }
        const roundEnd = endTurn(game, state)
        expect(roundEnd.processedActions[0].revealsInfo).toBe(true)
        expect(roundEnd.updatedState.revealedCardIds).toEqual(state.deck?.slice(0, 3))
    })

    it('lets a player apply the End turn into the final round without the hidden deck', () => {
        const { initialState, startedGame } = engine.startGame(createGame(), { masterSeed })
        let state = initialState
        const lastTurnOf = (round: number) =>
            state.round === round && state.turnIndex === state.turnManager.turnOrder.length - 1
        const endTurnAsPlayer = () => {
            const [playerId] = state.activePlayerIds
            assertExists(playerId, 'Expected an acting player')
            const perspective = { kind: 'player', playerId } as const
            return engine.executeAction({
                game: startedGame,
                state: MagnaGreciaRuntime.visibility.state.project(canonical(state), perspective, {
                    config: startedGame.config
                }),
                perspective,
                action: {
                    id: `end-${state.actionCount}`,
                    gameId: startedGame.id,
                    source: ActionSource.User,
                    playerId,
                    type: ActionType.EndTurn
                }
            })
        }

        while (!lastTurnOf(0)) {
            state = endTurn(startedGame, state).updatedState
        }
        expect(Visibility.isUnavailableProjectedValueError(thrownBy(endTurnAsPlayer))).toBe(true)

        while (!lastTurnOf(state.roundCount - 2)) {
            state = endTurn(startedGame, state).updatedState
        }
        const local = endTurnAsPlayer()
        const host = endTurn(startedGame, state)
        expect(local.updatedState.round).toBe(state.roundCount - 1)
        expect(local.updatedState.revealedCardIds).toEqual(state.revealedCardIds)
        expect(local.updatedState.turnManager.turnOrder).toEqual(
            host.updatedState.turnManager.turnOrder
        )
        expect(local.processedActions[0].revealsInfo).toBeUndefined()
        expect(host.processedActions[0].revealsInfo).toBeUndefined()
    })

    it('samples an exploration deck that keeps the revealed cards and the colour layers', () => {
        const game = createGame()
        const { initialState } = engine.startGame(game, { masterSeed })
        const projected = MagnaGreciaRuntime.visibility.state.project(
            canonical(initialState),
            spectator,
            { config: game.config }
        )
        const explored = MagnaGreciaRuntime.exploration.createFromProjectedState({
            game,
            state: projected,
            actions: [],
            perspective: spectator,
            random: getPrng(42)
        })
        expect(MagnaGreciaGameStateValidator.Check(explored)).toBe(true)
        expect(explored.deck?.slice(0, 2)).toEqual(projected.revealedCardIds)
        expect(explored.deck && layersHoldEveryColour(explored.deck)).toBe(true)

        const revealed = initialState.deck?.slice(0, 7) ?? []
        for (let seed = 1; seed <= 50; seed++) {
            const deck = sampleDeck(revealed, getPrng(seed))
            expect(deck.slice(0, 7)).toEqual(revealed)
            expect(new Set(deck).size).toBe(12)
            expect(layersHoldEveryColour(deck)).toBe(true)
        }
    })
})
