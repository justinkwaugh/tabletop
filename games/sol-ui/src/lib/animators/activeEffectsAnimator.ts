import { EffectType } from '@tabletop/sol'

import { gsap } from 'gsap'
import { Flip } from 'gsap/dist/Flip'

const CARD_WIDTH = 135
const CARD_HEIGHT = 100

const SCALE = 3
const GAP = 20

export class ActiveEffectsAnimator {
    private deckElement?: Element
    private effectElements: Map<EffectType, Element> = new Map()

    addDeck(element: Element): void {
        this.deckElement = element
    }

    removeDeck(): void {
        this.deckElement = undefined
    }

    addEffect(effect: EffectType, element: Element): void {
        this.effectElements.set(effect, element)
    }

    removeEffect(effect: EffectType): void {
        this.effectElements?.delete(effect)
    }

    expand() {
        if (!this.deckElement) {
            return
        }
        const elements = Array.from(this.effectElements.values()).toReversed()
        const state = Flip.getState([...elements, this.deckElement])

        const leftX = 0 + (1280 - (CARD_WIDTH * SCALE * 2 + GAP)) / 2
        const topY = 10

        gsap.set(this.deckElement, {
            translateX: leftX,
            translateY: topY
        })

        let i = 0
        for (const element of elements) {
            const x = (i % 2) * (CARD_WIDTH * SCALE + GAP)
            const y = Math.floor(i / 2) * (CARD_HEIGHT * SCALE + GAP)
            i++

            gsap.set(element, {
                translateX: x,
                translateY: y,
                scale: SCALE
            })
        }

        Flip.from(state, {
            duration: 0.5,
            ease: 'power1.inOut',
            stagger: 0.2
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
    params: { animator: ActiveEffectsAnimator }
): { destroy: () => void } | undefined {
    params.animator.addDeck(node)
    return {
        destroy() {
            params.animator.removeDeck()
        }
    }
}
