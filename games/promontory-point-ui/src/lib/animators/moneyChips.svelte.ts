import type { gsap } from 'gsap'

// R-1.3-H1: "+$4" or "−$6" rising from a seat card's money while its marker moves.
export type MoneyChip = { id: string; playerId: string; change: number }

// An element, or in a spec any object GSAP can tween.
export type ChipElement = gsap.TweenTarget

// Presence only: the money animator writes the replayed action's chips, mounts them, tweens their
// elements and clears them once that action's motion ends.
export class MoneyChips {
    chips: MoneyChip[] = $state([])

    private elements = new Map<string, ChipElement>()

    show(chips: MoneyChip[]) {
        this.chips = chips
    }

    clear() {
        this.chips = []
    }

    element(id: string): ChipElement | undefined {
        return this.elements.get(id)
    }

    setElement(id: string, element: ChipElement | undefined) {
        if (element) this.elements.set(id, element)
        else this.elements.delete(id)
    }
}

export function moneyChipText(change: number): string {
    return change < 0 ? `−$${-change}` : `+$${change}`
}

export function registerMoneyChip(node: HTMLElement, params: { chips: MoneyChips; id: string }) {
    params.chips.setElement(params.id, node)
    return {
        destroy() {
            if (params.chips.element(params.id) === node)
                params.chips.setElement(params.id, undefined)
        }
    }
}
