import { MarketColor, type Antique } from '@tabletop/marracash'

export const AntiqueItemNames: Record<MarketColor, string> = {
    [MarketColor.Yellow]: 'signet ring',
    [MarketColor.Red]: 'brass lantern',
    [MarketColor.Blue]: 'teapot',
    [MarketColor.Purple]: 'perfume bottle',
    [MarketColor.Green]: 'curved dagger'
}

export function antiqueColorSummary(cards: readonly Antique[]): string {
    const runs: { color: MarketColor; count: number }[] = []
    for (const card of cards) {
        const last = runs.at(-1)
        if (last?.color === card.color) last.count += 1
        else runs.push({ color: card.color, count: 1 })
    }
    return runs
        .map(({ color, count }) => {
            const name = color.charAt(0).toUpperCase() + color.slice(1)
            return count === 1 ? name : `${count}x ${name}`
        })
        .join(', ')
}

const ColorOrder = Object.values(MarketColor)

export function sortedAntiques<T extends Antique>(cards: readonly T[]): T[] {
    return cards.toSorted(
        (a, b) => ColorOrder.indexOf(a.color) - ColorOrder.indexOf(b.color) || a.value - b.value
    )
}
