import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isLookAtPoliticsPile, type PoliticsCard } from '@tabletop/lowenherz'
import type { PoliticsPile } from '$lib/model/politicsCardPiles.js'
import {
    buildSlotRows,
    chooserDeckCenter,
    responsiveCardWidth,
    type PileSlot
} from '$lib/model/politicsCardLayout.js'
import { preloadPoliticsCardFace } from '$lib/model/politicsCardImages.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * Opening a politics pile (LookAtPoliticsPile): the deck that was not chosen fades away, the
 * chosen deck slides to its seat at the head of the dealt row, and the pile's cards fly out of it.
 *
 * Pattern B: the cards only exist in `to`, which the table does not render until the session
 * assigns the new state after the shared timeline. While `dealing`, PoliticsPileReveal renders
 * this transient layout - both decks where PoliticsDeckChooser draws them, and the dealt row
 * from the same buildSlotRows the real row uses - so the handoff in either direction lands on
 * identical positions. Every position comes from the transition and the layout helpers, so
 * replay, undo and history navigation deal from the same place live play does.
 */
const LOSING_DECK_FADE = 0.22
const DECK_SLIDE = 0.38
const DEAL_START = LOSING_DECK_FADE + DECK_SLIDE
const DEAL_DURATION = 0.38
const DEAL_STAGGER = 0.045
const CARD_FADE_IN = 0.2

export type LosingDeck = { left: number; empty: boolean; pile: PoliticsPile }

export class PoliticsPileDealAnimator extends StateAnimator {
    dealing = $state(false)
    slotRows: PileSlot<PoliticsCard>[][] = $state([])
    cardWidth = $state(0)
    rowWidth = $state(0)
    losingDeck: LosingDeck | undefined = $state(undefined)
    dealtPile: PoliticsPile | undefined = $state(undefined)

    private nodes = new Map<string, HTMLElement>()
    private rowsEl: HTMLElement | undefined

    setNode(key: string, element?: HTMLElement) {
        if (element) this.nodes.set(key, element)
        else this.nodes.delete(key)
    }

    setRowsEl(element?: HTMLElement) {
        this.rowsEl = element
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        // Only the player taking a politics card ever sees the opened pile; to.openedPoliticsPile
        // is shared state, so every other client must not splay it.
        const myPlayerId = this.gameSession.myPlayer?.id
        if (!myPlayerId || to.politicsTakingPlayerId !== myPlayerId) return

        const pile =
            action && isLookAtPoliticsPile(action)
                ? action.pile
                : to.openedPoliticsPile && to.openedPoliticsPile !== from?.openedPoliticsPile
                  ? to.openedPoliticsPile
                  : undefined
        if (!pile) return

        const cards = to.inspectedPoliticsCards(myPlayerId) ?? []
        if (cards.length === 0) return

        this.slotRows = []
        this.losingDeck = undefined
        this.dealtPile = undefined
        this.dealing = true
        await tick()

        const row = this.rowsEl?.getBoundingClientRect()
        if (!row) {
            this.dealing = false
            return
        }
        this.rowWidth = row.width
        this.cardWidth = responsiveCardWidth(row.width)
        const otherPile = pile === 'A' ? 'B' : 'A'
        const chosenDeck = chooserDeckCenter(pile, row, this.cardWidth)
        const losingDeckCenter = chooserDeckCenter(otherPile, row, this.cardWidth)
        this.losingDeck = {
            left: losingDeckCenter.x - row.left - this.cardWidth / 2,
            empty: (from?.getPoliticsPileCount(otherPile) ?? 0) === 0,
            pile: otherPile
        }
        this.slotRows = buildSlotRows(cards, row.width, this.cardWidth)
        this.dealtPile = pile
        await tick()

        // Placed the instant they mount, before the preload wait below, so nothing paints at its
        // resting position first. Measured before any offset is applied.
        const deckNode = this.nodes.get('deck')
        const deckRect = deckNode?.getBoundingClientRect()
        if (deckNode && deckRect) {
            gsap.set(deckNode, {
                x: chosenDeck.x - (deckRect.left + deckRect.width / 2),
                y: chosenDeck.y - (deckRect.top + deckRect.height / 2)
            })
        }
        const dealOrigin = deckRect
            ? { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 }
            : chosenDeck

        const cardNodes = cards.flatMap((_, index) => {
            const node = this.nodes.get(String(index))
            if (!node) return []
            const rect = node.getBoundingClientRect()
            gsap.set(node, {
                x: dealOrigin.x - (rect.left + rect.width / 2),
                y: dealOrigin.y - (rect.top + rect.height / 2),
                scale: 0.3,
                opacity: 0
            })
            return [{ node, index }]
        })

        const cinematic = !!action
        if (cinematic) {
            await Promise.all(cards.map((card) => preloadPoliticsCardFace(card)))
        }

        const timeline = animationContext.actionTimeline
        const losingDeckNode = this.nodes.get('losing-deck')
        if (cinematic) {
            if (losingDeckNode) {
                timeline.to(
                    losingDeckNode,
                    { opacity: 0, scale: 0.85, duration: LOSING_DECK_FADE, ease: 'power1.in' },
                    0
                )
            }
            if (deckNode) {
                timeline.to(
                    deckNode,
                    { x: 0, y: 0, duration: DECK_SLIDE, ease: 'power2.inOut' },
                    LOSING_DECK_FADE
                )
                const dealSpan = (cards.length - 1) * DEAL_STAGGER + DEAL_DURATION
                timeline.to(
                    deckNode,
                    { opacity: 0, scale: 0.8, duration: dealSpan, ease: 'power1.in' },
                    DEAL_START
                )
            }
            for (const { node, index } of cardNodes) {
                const start = DEAL_START + index * DEAL_STAGGER
                timeline.to(node, { opacity: 1, duration: CARD_FADE_IN, ease: 'power1.out' }, start)
                timeline.to(
                    node,
                    { x: 0, y: 0, scale: 1, duration: DEAL_DURATION, ease: 'power2.out' },
                    start
                )
            }
        } else {
            if (losingDeckNode) {
                timeline.to(losingDeckNode, { opacity: 0, duration: FALLBACK_DURATION }, 0)
            }
            if (deckNode) {
                timeline.to(
                    deckNode,
                    { x: 0, y: 0, opacity: 0, duration: FALLBACK_DURATION, ease: 'power2.out' },
                    0
                )
            }
            for (const { node } of cardNodes) {
                timeline.to(
                    node,
                    {
                        x: 0,
                        y: 0,
                        scale: 1,
                        opacity: 1,
                        duration: FALLBACK_DURATION,
                        ease: 'power2.out'
                    },
                    0
                )
            }
        }

        animationContext.afterAnimations(() => {
            this.dealing = false
            this.slotRows = []
            this.losingDeck = undefined
            this.dealtPile = undefined
        })
    }

    override onDetach() {
        this.nodes.clear()
        this.rowsEl = undefined
        this.dealing = false
        this.slotRows = []
        this.losingDeck = undefined
        this.dealtPile = undefined
    }
}
