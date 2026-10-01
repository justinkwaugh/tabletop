import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    PlayerStatus,
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
import { SeededEngine } from './testEngine.js'

const spectator = { kind: 'spectator' } as const

const engine = new SeededEngine(11)

function createGame(seed = 5): Game {
    return MagnaGreciaRuntime.initializer.initializeGame(
        {
            id: 'magna-grecia-visibility',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed,
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

function layersHoldEveryColour(deck: readonly string[]): boolean {
    return [0, 1, 2].every(
        (layer) =>
            new Set(deck.slice(layer * 4, layer * 4 + 4).map((id) => actionCard(id).border))
                .size === 4
    )
}

describe('Magna Grecia visibility', () => {
    it('shuffles the deck from the protected stream so the public seed cannot rebuild it', () => {
        const first = engine.startGame(createGame(5)).initialState
        const otherPublicSeed = engine.startGame(createGame(6)).initialState
        const otherProtectedSeed = new SeededEngine(12).startGame(createGame(5)).initialState
        expect(otherPublicSeed.prng.seed).not.toBe(first.prng.seed)
        expect(otherPublicSeed.deck).toEqual(first.deck)
        expect(otherProtectedSeed.deck).not.toEqual(first.deck)
        expect(first.protectedPrng?.invocations).toBeGreaterThan(0)
    })

    it('shows only the played, current and upcoming cards', () => {
        const game = createGame()
        const { initialState } = engine.startGame(game)
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
        let state = engine.startGame(game).initialState
        const players = state.roundOrder.length
        for (let turn = 0; turn < players - 1; turn++) {
            const result = endTurn(game, state)
            expect(result.processedActions[0].revealsInfo).toBeUndefined()
            state = result.updatedState
        }
        const roundEnd = endTurn(game, state)
        expect(roundEnd.processedActions[0].revealsInfo).toBe(true)
        expect(roundEnd.updatedState.revealedCardIds).toEqual(state.deck?.slice(0, 3))
    })

    it('samples an exploration deck that keeps the revealed cards and the colour layers', () => {
        const game = createGame()
        const { initialState } = engine.startGame(game)
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
