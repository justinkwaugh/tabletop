/**
 * A card or writ in its own units. The band round the art is the part a seat colour fills on an
 * action card, so the art never has to carry one.
 */
export const CardBox = { width: 250, height: 380 }
export const CardArt = { x: 17.5, y: 15, width: 215, height: 348 }

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
