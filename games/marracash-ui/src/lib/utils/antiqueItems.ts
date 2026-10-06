import { MarketColor, type Antique } from '@tabletop/marracash'
import type { AntiqueProgress } from '$lib/utils/antiqueProgress.js'
import { ordinal } from '$lib/utils/ordinal.js'

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

export function missingAntiquesSummary(progress: readonly AntiqueProgress[]): string {
    const missing = progress.filter((entry) => !entry.covered).map((entry) => entry.card)
    return missing.length === 0 ? 'Set complete' : `Missing: ${antiqueColorSummary(missing)}`
}

export function completedSetLabel(revealRank: number): string {
    const rank = ordinal(revealRank)
    return `${rank.charAt(0).toUpperCase()}${rank.slice(1)} completed set`
}
