import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedPowerGridGameState } from '@tabletop/power-grid'
import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'

export type ArrivingHouse = { cityId: string; slot: number; playerId: string }

type HousesCallbacks = {
    // Presence only: mounts the houses of the `to` state before the state swap.
    showArrivals: (houses: ArrivingHouse[]) => void
    clearArrivals: () => void
}

const ACTION = { drop: 0.38, stagger: 0.16 }
// Undo and history steps end within 200ms.
const FAST = { drop: 0.15, stagger: 0 }

export function houseKey(cityId: string, slot: number): string {
    return `${cityId}:${slot}`
}

export function arrivingHouses(
    from: HydratedPowerGridGameState,
    to: HydratedPowerGridGameState
): ArrivingHouse[] {
    return Object.entries(to.cities).flatMap(([cityId, owners]) => {
        const before = from.occupants(cityId)
        return owners
            .map((playerId, slot) => ({ cityId, slot, playerId }))
            .filter(({ slot, playerId }) => before[slot] !== playerId)
    })
}

export class HousesAnimator {
    private elements = new Map<string, Element>()

    constructor(private callbacks: HousesCallbacks) {}

    attach(key: string): Attachment {
        return (node) => {
            this.elements.set(key, node)
            return () => {
                if (this.elements.get(key) === node) {
                    this.elements.delete(key)
                }
            }
        }
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedPowerGridGameState
        to: HydratedPowerGridGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        const arrivals = arrivingHouses(from, to)
        if (arrivals.length === 0) {
            return
        }
        this.callbacks.showArrivals(arrivals)
        animationContext.afterAnimations(() => this.callbacks.clearArrivals())
        await tick()

        const timing = action ? ACTION : FAST
        arrivals.forEach((house, index) => {
            const node = this.elements.get(houseKey(house.cityId, house.slot))
            if (!node) return
            animationContext.actionTimeline.fromTo(
                node,
                { y: -34, scale: 1.5, opacity: 0, transformOrigin: '50% 50%' },
                { y: 0, scale: 1, opacity: 1, duration: timing.drop, ease: 'bounce.out' },
                index * timing.stagger
            )
        })
    }
}
