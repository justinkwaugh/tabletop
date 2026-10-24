import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { isCompletePhase } from '../actions/completePhase.js'
import { isDrawCard, type DrawCard } from '../actions/drawCard.js'
import { CardDeck, cardDefinition, deckCards } from '../components/cards.js'
import { ScenarioId } from '../components/scenarios.js'
import { TechField } from '../components/techFields.js'
import { TechId } from '../components/techs.js'
import { cardPile, nextCardDrawer, recountPile } from '../model/cards.js'
import {
    StellarHorizonsGameStateValidator,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import {
    advanceTo,
    edit,
    endPhase,
    executeAll,
    hydrate,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { StellarHorizonsRuntime } from './runtime.js'
import { MachineState } from './states.js'

function campaign() {
    return startedGame(3, { scenario: ScenarioId.Campaign })
}

function cardCount(state: StellarHorizonsProjectedState): number {
    const hydrated = hydrate(state)
    return (
        hydrated.cardPiles.reduce((total, pile) => total + pile.remaining + pile.discarded, 0) +
        hydrated.players.reduce(
            (total, player) => total + player.hand.length + player.cards.length,
            0
        )
    )
}

describe('Cards in the campaign turn', () => {
    it('are dealt by System Actions before the first exploration phase', () => {
        const { state } = campaign()
        expect(state.machineState).toBe(MachineState.Exploring)
        expect(cardCount(state)).toBe(70)
        for (const player of hydrate(state).players) {
            expect(player.hand.length).toBeGreaterThanOrEqual(2)
            expect(player.cardDraws).toEqual([])
        }
    })

    it('are bought in the development Branch and replaced after it; buying nothing redraws', () => {
        const { game, state: start } = campaign()
        let state = advanceTo(game, start, TurnPhase.Development)
        const [buyer] = state.activePlayerIds
        const card = hydrate(state).getPlayerState(buyer).handCards(CardDeck.Genetic)[0]
        assertExists(card.cardId)
        const cost = cardDefinition(card.cardId).cost
        state = edit(state, (hydrated) => {
            hydrated.getPlayerState(buyer).techMarkers[TechField.Biology] = [
                5, 5, 5, 5, 5, 5, 5, 5, 5, 5
            ]
            hydrated.getPlayerState(buyer).cash = 0
        })
        const markers = Array.from({ length: Math.ceil(cost / 5) }, () => 5)
        const bought = executeAll(
            game,
            state,
            userAction(game, buyer, ActionType.BuyCard, {
                cardId: card.cardId,
                markers,
                cash: 0
            })
        )
        state = bought.state
        const afterBuy = hydrate(state).getPlayerState(buyer)
        expect(afterBuy.ownsCard(card.cardId)).toBe(true)
        expect(afterBuy.handCards(CardDeck.Genetic)).toEqual([])
        expect(afterBuy.fieldsDeveloped).toEqual([TechField.Biology])

        const processed: GameAction[] = []
        while (state.year === start.year) {
            const result =
                playPhaseOf(state) === undefined
                    ? undefined
                    : executeAll(
                          game,
                          state,
                          userAction(game, state.activePlayerIds[0], ActionType.EndPhase, {
                              phase: TurnPhase.Development
                          })
                      )
            if (!result) {
                break
            }
            processed.push(...result.processedActions)
            state = result.state
        }
        const completion = processed
            .filter(isCompletePhase)
            .find((action) => action.metadata?.phase === TurnPhase.Development)
        const discarded = completion?.metadata?.discardedHands ?? []
        expect(discarded).not.toContain(buyer)
        expect(discarded.length).toBe(2)
        // The buyer's replacement, and a whole new hand for each Player who bought nothing.
        const kept = processed.filter(isDrawCard).filter((action) => action.metadata?.kept)
        const redrawn = discarded.reduce(
            (total, playerId) => total + hydrate(start).getPlayerState(playerId).hand.length,
            0
        )
        expect(kept).toHaveLength(1 + redrawn)
        const after = hydrate(state)
        expect(after.getPlayerState(buyer).handCards(CardDeck.Genetic)).toHaveLength(1)
        expect(after.cardPiles.every((pile) => pile.discarded === 0)).toBe(true)
        expect(cardCount(state)).toBe(70)
    })

    it('lets the drawer choose the level when their techs allow more than one', () => {
        const { game, state: start } = campaign()
        let state = advanceTo(game, start, TurnPhase.Development)
        const [first] = state.activePlayerIds
        state = edit(state, (hydrated) => {
            hydrated
                .getPlayerState(first)
                .techs.push({ techId: TechId.StarshipTheoreticalConcepts, year: 2090 })
            hydrated.getPlayerState(first).cash = 0
            hydrated.getPlayerState(first).techMarkers = {
                Biology: [],
                Physics: [],
                Engineering: []
            }
        })
        while (state.machineState !== MachineState.DrawingCards) {
            state = endPhase(game, state)
        }
        while (hydrate(state).getPlayerState(first).cardDraws[0] !== CardDeck.Fleet) {
            expect(nextCardDrawer(hydrate(state))).not.toBe(first)
            state = executeAll(
                game,
                state,
                userAction(game, state.activePlayerIds[0], ActionType.DrawCard, {
                    deck: hydrate(state).getPlayerState(state.activePlayerIds[0]).cardDraws[0],
                    level: 1
                })
            ).state
        }
        expect(state.activePlayerIds).toEqual([first])
        const drawn = executeAll(
            game,
            state,
            userAction(game, first, ActionType.DrawCard, { deck: CardDeck.Fleet, level: 2 })
        )
        const draw = drawn.processedActions.find(isDrawCard)
        const metadata = draw?.metadata
        assertExists(metadata?.drawn?.cardId)
        expect(cardDefinition(metadata.drawn.cardId).level).toBe(2)
        expect(draw?.revealsInfo).toBe(true)
    })
})

function playPhaseOf(state: StellarHorizonsProjectedState): TurnPhase | undefined {
    return state.machineState === MachineState.Developing ? TurnPhase.Development : undefined
}

describe('Card visibility', () => {
    it('shows a hand’s backs to everyone and its cards to its owner; decks to nobody', () => {
        const { game, state } = campaign()
        if (!StellarHorizonsGameStateValidator.Check(state)) {
            throw new Error('Expected complete canonical state')
        }
        const [viewer, other] = state.players.map((player) => player.playerId)
        const view = StellarHorizonsRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: viewer },
            { config: game.config }
        )
        const mine = view.players.find((player) => player.playerId === viewer)
        const theirs = view.players.find((player) => player.playerId === other)
        expect(mine?.hand.every((card) => card.cardId !== undefined)).toBe(true)
        expect(theirs?.hand.length).toBeGreaterThan(0)
        expect(theirs?.hand.every((card) => card.cardId === undefined && card.level === 1)).toBe(
            true
        )
        expect(view.cardPiles.every((pile) => pile.cards.length === 0)).toBe(true)
        expect(view.cardPiles.map((pile) => pile.remaining)).toEqual(
            state.cardPiles.map((pile) => pile.remaining)
        )
        expect(() => StellarHorizonsRuntime.hydrator.hydrateState(view)).not.toThrow()
    })

    it('shows a drawn card only to its drawer', () => {
        const { game } = campaign()
        const action: DrawCard = {
            id: 'draw',
            gameId: game.id,
            source: ActionSource.System,
            type: ActionType.DrawCard,
            playerId: 'p0',
            deck: CardDeck.Fleet,
            level: 1,
            metadata: { drawn: { playerId: 'p0', cardId: 'robo-miners' }, kept: true }
        }
        const project = (playerId: string): DrawCard => {
            const projected = StellarHorizonsRuntime.visibility.actions.project(
                action,
                { kind: 'player', playerId },
                { config: game.config }
            )
            if (!isDrawCard(projected)) {
                throw new Error('Expected a DrawCard')
            }
            return projected
        }
        expect(project('p0').metadata?.drawn?.cardId).toBe('robo-miners')
        expect(project('p1').metadata?.drawn).toEqual({ playerId: 'p0' })
        expect(project('p1').metadata?.kept).toBe(true)
    })

    it('samples the unseen cards for exploration from a Player’s view', () => {
        const { game, state } = campaign()
        if (!StellarHorizonsGameStateValidator.Check(state)) {
            throw new Error('Expected complete canonical state')
        }
        const viewer = state.players[0].playerId
        const view = StellarHorizonsRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: viewer },
            { config: game.config }
        )
        const populate = StellarHorizonsRuntime.exploration.createFromProjectedState
        assertExists(populate)
        let seed = 1
        const sample = populate({
            game,
            state: view,
            actions: [],
            perspective: { kind: 'player', playerId: viewer },
            random: () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
        })
        expect(StellarHorizonsGameStateValidator.Check(sample)).toBe(true)
        expect(cardCount(sample)).toBe(70)
        expect(sample.players[0].hand).toEqual(state.players[0].hand)
        const hydrated = hydrate(sample)
        for (const player of hydrated.players) {
            expect(new Set(player.hand.map((card) => card.cardId)).size).toBe(player.hand.length)
        }
        expect(cardPile(hydrated, CardDeck.Fleet, 1).cards).toHaveLength(
            cardPile(hydrate(state), CardDeck.Fleet, 1).remaining
        )
    })

    it('finds a deal for the hidden hands whenever one exists', () => {
        const { game, state: start } = campaign()
        const [viewer, first, second] = start.players.map((player) => player.playerId)
        const copy = 'resilient-crews'
        // Level I fleet: the second Player owns a copy of Resilient Crews and holds the other;
        // the first holds Robo Miners, and the viewer owns the rest. Sampled card by card, the
        // first Player could take the copy and leave the second only a card they already own.
        const state = edit(start, (hydrated) => {
            const pile = cardPile(hydrated, CardDeck.Fleet, 1)
            const rest = deckCards(CardDeck.Fleet, 1)
            for (const cardId of [copy, copy, 'robo-miners']) {
                rest.splice(rest.indexOf(cardId), 1)
            }
            for (const player of hydrated.players) {
                player.hand = player.hand.filter((card) => card.deck !== CardDeck.Fleet)
                player.cards = []
            }
            const hand = (playerId: string, cardId: string) =>
                hydrated
                    .getPlayerState(playerId)
                    .hand.push({ playerId, deck: CardDeck.Fleet, level: 1, cardId })
            hand(first, 'robo-miners')
            hand(second, copy)
            hydrated.getPlayerState(second).cards.push({ cardId: copy, year: 2090, bought: true })
            hydrated
                .getPlayerState(viewer)
                .cards.push(...rest.map((cardId) => ({ cardId, year: 2090, bought: true })))
            pile.cards = []
            pile.discards = []
            recountPile(pile)
        })
        if (!StellarHorizonsGameStateValidator.Check(state)) {
            throw new Error('Expected complete canonical state')
        }
        const view = StellarHorizonsRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: viewer },
            { config: game.config }
        )
        const populate = StellarHorizonsRuntime.exploration.createFromProjectedState
        assertExists(populate)
        for (let seed = 1; seed <= 20; seed++) {
            let value = seed
            const sample = populate({
                game,
                state: view,
                actions: [],
                perspective: { kind: 'player', playerId: viewer },
                random: () => ((value = (value * 16807) % 2147483647) - 1) / 2147483646
            })
            const fleet = (playerId: string) =>
                sample.players
                    .find((player) => player.playerId === playerId)
                    ?.hand.find((card) => card.deck === CardDeck.Fleet)?.cardId
            expect(fleet(first)).toBe(copy)
            expect(fleet(second)).toBe('robo-miners')
        }
    })
})
