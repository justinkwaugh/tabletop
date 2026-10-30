import { contrastingTextColor } from './contrastingTextColor.js'

/** A revenue stage's colour, or for a stage spanning phases each phase's colour, left to right. */
export type RevenueStageColor = string | readonly string[]
export type RevenueStageColors = Readonly<Record<string, RevenueStageColor>>

export function revenueStageFills(
    colors: RevenueStageColors,
    stage: string,
    fallback: string
): readonly string[] {
    const color = colors[stage] ?? fallback
    return typeof color === 'string' ? [color] : color
}

/** Text readable across a divided background: the contrast of its colours' average. */
export function dividedTextColor(fills: readonly string[]): string {
    if (fills.length === 1 || !fills.every((fill) => /^#[0-9a-f]{6}$/i.test(fill)))
        return contrastingTextColor(fills[0])
    const average = [1, 3, 5].map((offset) =>
        Math.round(
            fills.reduce((sum, fill) => sum + parseInt(fill.slice(offset, offset + 2), 16), 0) /
                fills.length
        )
    )
    return contrastingTextColor(
        `#${average.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
    )
}
