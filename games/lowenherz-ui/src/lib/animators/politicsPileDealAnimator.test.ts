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
    settlePoliticsPileOrigin,
    type OriginElement,
    type PoliticsPileOriginHandle
} from '$lib/model/politicsPileOrigin.js'
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

function deckElement(): OriginElement & { isConnected: boolean } {
    return {
        isConnected: true,
        getBoundingClientRect: () => ({
            x: 300,
            y: 100,
            width: 66,
            height: 103,
            top: 100,
            left: 300,
            right: 366,
            bottom: 203,
            toJSON: () => ({})
        })
    }
}

// The session's own settlePoliticsPileOrigin is a one-line pass-through to the module function
// over its private handle; this stands in for exactly that, over a real handle.
function sessionHolding(handle: PoliticsPileOriginHandle | undefined): LowenherzGameSession {
    const session = {
        myPlayer: { id: PLAYER },
        politicsRowWidth: 600,
        settlePoliticsPileOrigin: () => (handle ? settlePoliticsPileOrigin(handle) : undefined),
        addGameStateChangeListener() {},
        removeGameStateChangeListener() {}
    }
    return session as unknown as LowenherzGameSession
}

function stateWithPile(openedPoliticsPile: 'A' | 'B' | undefined): HydratedLowenherzGameState {
    const state = {
        politicsTakingPlayerId: PLAYER,
        openedPoliticsPile,
        inspectedPoliticsCards: () => (openedPoliticsPile ? CARDS : undefined)
    }
    return state as unknown as HydratedLowenherzGameState
}

function animationCycle() {
    const finishers: (() => void)[] = []
    const context = {
        actionTimeline: gsap.timeline({ paused: true }),
        finalTimeline: gsap.timeline({ paused: true }),
        afterAnimations: (finisher: () => void) => finishers.push(finisher)
    }
    return {
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

describe('PoliticsPileDealAnimator across a pile opening replayed from history', () => {
    it('deals live, then still deals when the opening is replayed after the deck has gone', async () => {
        const deck = deckElement()
        const handle: PoliticsPileOriginHandle = { element: deck }
        const animator = new PoliticsPileDealAnimator(sessionHolding(handle))

        // The live deal: the chooser has handed its deck over, the host has answered.
        const live = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A'),
            from: stateWithPile(undefined),
            action: openPileAction,
            animationContext: live.context
        })
        expect(animator.dealing).toBe(true)
        expect(handle.point).toEqual({ x: 333, y: 151.5 })
        expect(handle.element).toBeUndefined()
        live.finish()
        expect(animator.dealing).toBe(false)

        // The reveal took the slot and the chooser's deck left the page.
        deck.isConnected = false

        // Undo back over the opening, then forward again: an actionless transition that reopens
        // the pile. The deal has to start from the settled point, since no deck exists any more.
        const replay = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A'),
            from: stateWithPile(undefined),
            animationContext: replay.context
        })
        expect(animator.dealing).toBe(true)
        replay.finish()
    })

    it('renders the row in place instead when no origin was ever settled', async () => {
        const deck = deckElement()
        deck.isConnected = false
        const animator = new PoliticsPileDealAnimator(sessionHolding({ element: deck }))

        const replay = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile('A'),
            from: stateWithPile(undefined),
            animationContext: replay.context
        })
        expect(animator.dealing).toBe(false)
    })

    it('does nothing for a transition that closes the pile', async () => {
        const animator = new PoliticsPileDealAnimator(sessionHolding({ point: { x: 1, y: 2 } }))

        const undo = animationCycle()
        await animator.onGameStateChange({
            to: stateWithPile(undefined),
            from: stateWithPile('A'),
            animationContext: undo.context
        })
        expect(animator.dealing).toBe(false)
    })
})
