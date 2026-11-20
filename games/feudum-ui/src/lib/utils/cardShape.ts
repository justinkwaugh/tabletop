import { Color, type Point } from '@tabletop/common'
import type { ActionCardKind } from '@tabletop/feudum'
import type { PrintedColour } from '$lib/art/assetMap.js'

export const CardBox = { width: 250, height: 380 }
export const CardArt = { x: 17.5, y: 15, width: 215, height: 348 }

export const PrintedCard = { width: 580, height: 938 } as const
const PrintScale = CardBox.height / PrintedCard.height

export const PrintedCardPlace = {
    x: (CardBox.width - PrintedCard.width * PrintScale) / 2,
    scale: PrintScale
} as const

export const PrintedCardCorner = 24

/** Measured on the print (the palette's `print-frame`). */
export const PrintBand: Record<PrintedColour, string> = {
    [Color.Red]: 'var(--feudum-print-frame-red)',
    [Color.Blue]: 'var(--feudum-print-frame-blue)',
    [Color.Green]: 'var(--feudum-print-frame-green)',
    [Color.Purple]: 'var(--feudum-print-frame-purple)',
    [Color.Yellow]: 'var(--feudum-print-frame-yellow)'
}

/** Measured on the print, in its pixels. */
export const PrintFrame = { x: 6, y: 2, width: 566, height: 909, bar: 15, round: 9, rosette: 30 }

export function printFrameRect(inset: number) {
    const { x, y, width, height } = PrintFrame
    return { x: x + inset, y: y + inset, width: width - 2 * inset, height: height - 2 * inset }
}

export const PrintArtWindow = {
    x: PrintFrame.x + PrintFrame.bar,
    y: PrintFrame.y,
    width: PrintFrame.width - 2 * PrintFrame.bar,
    height: PrintFrame.height
}

/** Found by matching each art file to its printed card: each is cut a little differently. */
export const PrintedArtScale = 0.9
export const PrintedArtAt: Record<ActionCardKind, Point> = {
    conquer: { x: 14, y: 4 },
    defend: { x: 13, y: -3 },
    explore: { x: 1, y: 4 },
    guild: { x: 3, y: 3 },
    harvest: { x: 5, y: 5 },
    improve: { x: 7, y: 5 },
    influence: { x: 12, y: 4 },
    migrate: { x: 12, y: -3 },
    move: { x: 0, y: 4 },
    repeat: { x: 10, y: 4 },
    tax: { x: 8, y: 4 }
}
export const PrintedArtFile = { width: 618, height: 1000 } as const

export function printRosettes(): { disc: string; rings: [string, string, string] }[] {
    const { x, y, width, height, bar, rosette } = PrintFrame
    const left = x + bar
    const right = x + width - bar
    const top = y + bar
    const foot = y + height - bar
    const corners = [
        [left, top, 1, 1],
        [right, top, -1, 1],
        [left, foot, 1, -1],
        [right, foot, -1, -1]
    ] as const
    return corners.map(([cx, cy, sx, sy]) => {
        const arc = (r: number) =>
            `M${cx + sx * r} ${cy}A${r} ${r} 0 0 ${sx * sy > 0 ? 1 : 0} ${cx} ${cy + sy * r}`
        return {
            disc: `${arc(rosette)}L${cx} ${cy}Z`,
            rings: [arc(rosette - 3), arc(rosette - 8), arc(rosette - 13)]
        }
    })
}

export type FaceTier = 'compact' | 'standard' | 'full'

/** The contract's three tiers by width: one component, never a second asset. */
export function faceTier(width: number): FaceTier {
    if (width < 60) {
        return 'compact'
    }
    return width < 180 ? 'standard' : 'full'
}

export function wrapLines(text: string, charactersPerRow: number): string[] {
    const rows: string[] = []
    let row = ''
    for (const word of text.split(' ')) {
        if (row && row.length + word.length + 1 > charactersPerRow) {
            rows.push(row)
            row = word
        } else {
            row = row ? `${row} ${word}` : word
        }
    }
    return row ? [...rows, row] : rows
}

/** A word of data cut, never a second string to translate. */
export function shortName(name: string, characters = 6): string {
    return name.length <= characters ? name : `${name.slice(0, characters - 1)}.`
}
