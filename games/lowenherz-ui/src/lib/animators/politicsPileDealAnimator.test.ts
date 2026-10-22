import { describe, expect, it, vi } from 'vitest'
import { gsap } from 'gsap'
import { ActionSource } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    ActionType,
    PoliticsCardType,
    type HydratedLowenherzGameState,
    type LookAtPoliticsPile,
    type PoliticsCard
} from '@tabletop/lowenherz'
import type { LowenherzGameSession } from '$lib/model/session.svelte.js'
import {
    CHOOSER_DECK_GAP,
    chooserDeckCenter,
    responsiveCardWidth
} from '$lib/model/politicsCardLayout.js'
import { PoliticsPileDealAnimator } from './politicsPileDealAnimator.svelte.js'

// Face art is decoded through `new Image()`, which does not exist off the browser.
vi.mock('$lib/model/politicsCardImages.js', () => ({
    preloadPoliticsCardFace: () => Promise.resolve()
}))

const PLAYER = 'player-1'
const CARDS: PoliticsCard[] = [
    { type: PoliticsCardType.Treasure, value: 8 },
    { type: PoliticsCardType.Alliance }
]
const ROW = { left: 100, top: 50, width: 600 }

function rowsElement(): HTMLElement {
    const element = {
        getBoundingClientRect: () => ({
            x: ROW.left,
            y: ROW.top,
            width: ROW.width,
            height: 0,
            top: ROW.top,
            left: ROW.left,
            right: ROW.left + ROW.width,
            bottom: ROW.top,
            toJSON: () => ({})
        })
    }
    return element as unknown as HTMLElement
}

// GSAP tweens a plain object's own properties, so these stand in for the mounted deck and card
// elements: each reports a fixed resting rect and carries the values the timeline writes.
type FakeNode = { x: number; y: number; scale: number; opacity: number }

function fakeNode(centerX: number, centerY: number): FakeNode {
    const size = 40
    return {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        getBoundingClientRect: () => ({
            left: centerX - size / 2,
            top: centerY - size / 2,
            width: size,
            height: size
        })
    } as FakeNode
}

function session(): LowenherzGameSession {
    const stub = {
        myPlayer: { id: PLAYER },
        addGameStateChangeListener() {},
        removeGameStateChangeListener() {}
    }
    return stub as unknown as LowenherzGameSession
}

function stateWithPile(
    openedPoliticsPile: 'A' | 'B' | undefined,
    politicsTakingPlayerId = PLAYER
): HydratedLowenherzGameState {
    const state = {
        politicsTakingPlayerId,
        openedPoliticsPile,
        inspectedPoliticsCards: () => (openedPoliticsPile ? CARDS : undefined),
        getPoliticsPileCount: () => 3
    }
    return state as unknown as HydratedLowenherzGameState
}

function animationCycle() {
    const finishers: (() => void)[] = []
    const actionTimeline = gsap.timeline({ paused: true })
    const context = {
        actionTimeline,
        finalTimeline: gsap.timeline({ paused: true }),
        afterAnimations: (finisher: () => void) => finishers.push(finisher)
    }
    return {
        actionTimeline,
        context: context as unknown as AnimationContext,
        finish: () => finishers.splice(0).forEach((finisher) => finisher())
    }
}

const openPileAction: LookAtPoliticsPile = {
    id: 'open-a',
    gameId: 'game-1',
    source: ActionSource.User,
    type: ActionType.LookAtPoliticsPile,
    playerId: PLAYER,
    pile: 'A',
    revealsInfo: true
}

function animatorWithRow() {
    const animator = new PoliticsPileDealAnimator(session())
    animator.setRowsEl(rowsElement())
    return animator
}

// The chosen deck rests at slot 0 and the dealt cards in a row to its right.
const DECK_REST = { x: 130, y: 120 }
const CARD_REST = [
    { x: 220, y: 120 },
    { x: 310, y: 120 }
]

function animatorWithNodes() {
    const animator = animatorWithRow()
    const deck = fakeNode(DECK_REST.x, DECK_REST.y)
    const losingDeck = fakeNode(500, 120)
    const cards = CARD_REST.map((rest) => fakeNode(rest.x, rest.y))
    animator.setNode('deck', deck as unknown as HTMLElement)
    animator.setNode('losing-deck', losingDeck as unknown as HTMLElement)
    cards.forEach((card, index) => animator.setNode(String(index), card as unknown as HTMLElement))
    return { animator, deck, losingDeck, cards }
}

describe('PoliticsPileDealAnimator', () => {
    it('deals the opened pile, fading the other deck where the chooser drew it', async () => {
        const animator = animatorWithRow()

        const live = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A'),
            from: stateWithPile(undefined),
            action: openPileAction,
            animationContext: live.context
        })

        const cardWidth = responsiveCardWidth(ROW.width)
        expect(animator.dealing).toBe(true)
        expect(animator.rowWidth).toBe(ROW.width)
        expect(animator.cardWidth).toBe(cardWidth)
        expect(animator.losingDeck).toEqual({
            left: ROW.width / 2 + CHOOSER_DECK_GAP / 2,
            empty: false,
            pile: 'B'
        })
        expect(animator.dealtPile).toBe('A')
        live.finish()
        expect(animator.dealing).toBe(false)
        expect(animator.losingDeck).toBeUndefined()
        expect(animator.dealtPile).toBeUndefined()
    })

    it('deals an opening reached by history navigation, with no live click behind it', async () => {
        const animator = animatorWithRow()

        const navigation = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('B'),
            from: stateWithPile(undefined),
            animationContext: navigation.context
        })

        expect(animator.dealing).toBe(true)
        expect(animator.losingDeck?.left).toBeCloseTo(
            ROW.width / 2 - CHOOSER_DECK_GAP / 2 - responsiveCardWidth(ROW.width)
        )
        expect(navigation.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
        navigation.finish()
    })

    it('fades the other deck, slides the chosen one to slot 0, then deals from it', async () => {
        const { animator, deck, losingDeck, cards } = animatorWithNodes()

        const live = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A'),
            from: stateWithPile(undefined),
            action: openPileAction,
            animationContext: live.context
        })

        // The chosen deck starts where the chooser drew it; the cards wait, hidden, on the deck.
        const chosen = chooserDeckCenter('A', ROW, responsiveCardWidth(ROW.width))
        const deckOffset = { x: chosen.x - DECK_REST.x, y: chosen.y - DECK_REST.y }
        expect(deck.x).toBeCloseTo(deckOffset.x)
        expect(deck.y).toBeCloseTo(deckOffset.y)
        for (const card of cards) {
            expect(card.opacity).toBe(0)
            expect(card.scale).toBeCloseTo(0.3)
        }
        expect(cards[0].x).toBeCloseTo(DECK_REST.x - CARD_REST[0].x)

        const timeline = live.actionTimeline
        // The other deck fades first, while the chosen deck holds its place.
        timeline.seek(0.22)
        expect(losingDeck.opacity).toBeCloseTo(0)
        expect(deck.x).toBeCloseTo(deckOffset.x)
        expect(cards[0].opacity).toBe(0)

        // Then the chosen deck slides to slot 0, before any card leaves it.
        timeline.seek(0.6)
        expect(deck.x).toBeCloseTo(0)
        expect(deck.y).toBeCloseTo(0)
        expect(cards[0].opacity).toBeCloseTo(0)
        expect(cards[0].x).toBeCloseTo(DECK_REST.x - CARD_REST[0].x)

        // The deal is staggered: the first card is under way before the second starts.
        timeline.seek(0.64)
        expect(cards[0].opacity).toBeGreaterThan(0)
        expect(cards[1].opacity).toBe(0)

        timeline.seek(timeline.duration())
        expect(deck.opacity).toBeCloseTo(0)
        for (const card of cards) {
            expect(card.x).toBeCloseTo(0)
            expect(card.y).toBeCloseTo(0)
            expect(card.scale).toBeCloseTo(1)
            expect(card.opacity).toBeCloseTo(1)
        }
        live.finish()
    })

    it('settles every node within the fallback budget when no action is behind the opening', async () => {
        const { animator, deck, losingDeck, cards } = animatorWithNodes()

        const navigation = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A'),
            from: stateWithPile(undefined),
            animationContext: navigation.context
        })

        const timeline = navigation.actionTimeline
        expect(timeline.duration()).toBeGreaterThan(0)
        expect(timeline.duration()).toBeLessThanOrEqual(0.2)
        timeline.seek(timeline.duration())
        expect(losingDeck.opacity).toBeCloseTo(0)
        expect(deck.x).toBeCloseTo(0)
        expect(deck.opacity).toBeCloseTo(0)
        for (const card of cards) {
            expect(card.x).toBeCloseTo(0)
            expect(card.y).toBeCloseTo(0)
            expect(card.opacity).toBeCloseTo(1)
        }
        navigation.finish()
    })

    it('does nothing for a transition that closes the pile', async () => {
        const animator = animatorWithRow()

        const undo = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile(undefined),
            from: stateWithPile('A'),
            animationContext: undo.context
        })
        expect(animator.dealing).toBe(false)
    })

    it("never splays another player's pile", async () => {
        const animator = animatorWithRow()

        const opponent = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A', 'player-2'),
            from: stateWithPile(undefined, 'player-2'),
            action: { ...openPileAction, playerId: 'player-2' },
            animationContext: opponent.context
        })
        expect(animator.dealing).toBe(false)
    })
})
