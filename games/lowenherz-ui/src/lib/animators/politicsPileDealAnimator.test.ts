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
import { CHOOSER_DECK_GAP, responsiveCardWidth } from '$lib/model/politicsCardLayout.js'
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
            empty: false
        })
        live.finish()
        expect(animator.dealing).toBe(false)
        expect(animator.losingDeck).toBeUndefined()
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
