import { EffectType } from '@tabletop/sol'

import { gsap } from 'gsap'
import { Flip } from 'gsap/dist/Flip'
import type { Point } from '@tabletop/common'

const CARD_WIDTH = 135
const CARD_HEIGHT = 100

const SCALE = 3
const GAP = 20

export class ActiveEffectsAnimator {
    private deckElement?: Element
    private deckLocation?: Point
    private effectElements: Map<EffectType, Element> = new Map()
    private collapsedState?: Flip.FlipState
    private expanded = false
    private currentTimeline?: gsap.core.Timeline = undefined

    addDeck(element: Element): void {
        this.deckElement = element
    }

    removeDeck(): void {
        this.deckElement = undefined
        this.deckLocation = undefined
        this.collapsedState = undefined
        this.expanded = false
    }

    setDeckLocation(location: Point): void {
        this.deckLocation = location
    }

    addEffect(effect: EffectType, element: Element): void {
        this.effectElements.set(effect, element)
    }

    removeEffect(effect: EffectType): void {
        this.effectElements?.delete(effect)
    }

    toggle() {
        if (this.currentTimeline) {
            this.currentTimeline.kill()
            this.currentTimeline = undefined
        }

        if (this.expanded) {
            this.contract()
            return
        }
        this.expand()
    }

    expand() {
        if (!this.deckElement || this.expanded) {
            return
        }
        const elements = Array.from(this.effectElements.values())
        if (elements.length === 0) {
            return
        }

        this.collapsedState = Flip.getState(elements)
        this.expanded = true

        const boardLeft = (1280 - (CARD_WIDTH * SCALE * 2 + GAP)) / 2
        const boardTop = 10

        const deckOrigin = this.deckLocation ?? {
            x: 0,
            y: 0
        }

        let i = 0
        for (const element of elements.toReversed()) {
            const x = boardLeft - deckOrigin.x + (i % 2) * (CARD_WIDTH * SCALE + GAP)
            const y = boardTop - deckOrigin.y + Math.floor(i / 2) * (CARD_HEIGHT * SCALE + GAP)
            i++

            gsap.set(element, {
                translateX: x,
                translateY: y,
                scale: SCALE,
                transformOrigin: '0 0'
            })
        }

        this.currentTimeline = Flip.from(this.collapsedState, {
            duration: 0.3,
            ease: 'power1.inOut',
            stagger: 0.15,
            scale: true,
            onComplete: () => {
                this.currentTimeline = undefined
            }
        })
    }

    contract() {
        if (!this.expanded || !this.collapsedState) {
            return
        }

        const state = this.collapsedState
        this.expanded = false

        this.currentTimeline = Flip.to(state, {
            duration: 0.3,
            ease: 'power1.inOut',
            stagger: { each: 0.15, from: 'end' },
            scale: true,
            onComplete: () => {
                this.currentTimeline = undefined
            }
        })
    }
}

export function animateEffectCard(
    node: HTMLElement | SVGElement,
    params: { animator: ActiveEffectsAnimator; effect: EffectType }
): { destroy: () => void } | undefined {
    params.animator.addEffect(params.effect, node)
    return {
        destroy() {
            params.animator.removeEffect(params.effect)
        }
    }
}

export function animateDeck(
    node: HTMLElement | SVGElement,
    params: { animator: ActiveEffectsAnimator; location: Point }
):
    | {
          update: (params: { animator: ActiveEffectsAnimator; location: Point }) => void
          destroy: () => void
      }
    | undefined {
    params.animator.addDeck(node)
    params.animator.setDeckLocation(params.location)
    return {
        update(nextParams: { animator: ActiveEffectsAnimator; location: Point }) {
            nextParams.animator.setDeckLocation(nextParams.location)
        },
        destroy() {
            params.animator.removeDeck()
        }
    }
}
