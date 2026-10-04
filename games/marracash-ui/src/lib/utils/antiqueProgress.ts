import type { Antique, MarketColor } from '@tabletop/marracash'

export type AntiqueProgress = { card: Antique; covered: boolean }

export function antiqueProgress(
    cards: readonly Antique[],
    customersByColor: Readonly<Record<MarketColor, number>>
): AntiqueProgress[] {
    const remaining = { ...customersByColor }
    return cards.map((card) => {
        const covered = remaining[card.color] > 0
        if (covered) {
            remaining[card.color] -= 1
        }
        return { card, covered }
    })
}
