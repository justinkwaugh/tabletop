import { Color } from '@tabletop/common'
import type { ActionCardKind } from '@tabletop/feudum'
import type { PrintedColour } from '$lib/art/assetMap.js'

/**
 * A card or writ in its own units. The band round the art is the part a seat colour fills on an
 * action card, so the art never has to carry one.
 */
export const CardBox = { width: 250, height: 380 }
export const CardArt = { x: 17.5, y: 15, width: 215, height: 348 }

/** A printed action card, in its own pixels: drawn whole and centred in `CardBox`, never stretched. */
export const PrintedCard = { width: 580, height: 938 } as const
const PrintScale = CardBox.height / PrintedCard.height

/** Where the print stands in `CardBox`: its pixels scaled to the card's height, centred across. */
export const PrintedCardPlace = {
    x: (CardBox.width - PrintedCard.width * PrintScale) / 2,
    scale: PrintScale
} as const

/**
 * The foot's line naming the card in the print's other languages, measured on the print, in its
 * pixels: each card's line across, padded, from its top to the print's foot, less a notch where the
 * frame's jewel dips into it. Its frame is one flat colour in each printed colour.
 */
export const PrintedNameLine = {
    top: 915,
    jewel: { from: 278, to: 310, foot: 918.5 },
    across: {
        conquer: { from: 148, to: 428 },
        defend: { from: 116, to: 449 },
        explore: { from: 141, to: 408 },
        guild: { from: 206, to: 387 },
        harvest: { from: 213, to: 405 },
        improve: { from: 183, to: 425 },
        influence: { from: 183, to: 429 },
        migrate: { from: 161, to: 385 },
        move: { from: 148, to: 447 },
        repeat: { from: 97, to: 400 },
        tax: { from: 182, to: 369 }
    } satisfies Record<ActionCardKind, { from: number; to: number }>
} as const

/** The printed frame's colour round the name line, measured on the print (the palette's `print-frame`). */
export const PrintedFrameFoot: Record<PrintedColour, string> = {
    [Color.Red]: 'var(--feudum-print-frame-red)',
    [Color.Blue]: 'var(--feudum-print-frame-blue)',
    [Color.Green]: 'var(--feudum-print-frame-green)',
    [Color.Purple]: 'var(--feudum-print-frame-purple)',
    [Color.Yellow]: 'var(--feudum-print-frame-yellow)'
}

/** The name line's cover as an SVG path in the print's pixels, the jewel's notch left open. */
export function printedNameLinePath(kind: ActionCardKind): string {
    const { top, jewel, across } = PrintedNameLine
    const { from, to } = across[kind]
    return `M${from} ${top}H${jewel.from}V${jewel.foot}H${jewel.to}V${top}H${to}V${PrintedCard.height}H${from}Z`
}

export type FaceTier = 'compact' | 'standard' | 'full'

/** The contract's three tiers, by the width a face is given: one component, never a second asset. */
export function faceTier(width: number): FaceTier {
    if (width < 60) {
        return 'compact'
    }
    return width < 180 ? 'standard' : 'full'
}

/** Breaks a line of data for an SVG text row, at about this many characters a row. */
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

/** A compact face's short name: a word of data cut, never a second string to translate. */
export function shortName(name: string, characters = 6): string {
    return name.length <= characters ? name : `${name.slice(0, characters - 1)}.`
}
