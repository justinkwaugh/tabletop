/** The space between two minor chips, and between the majors and the minors beside them, in px. */
export const CHIP_GAP = 6
export const BESIDE_GAP = 8

/**
 * The minors' one width, in whole px, and how they stand: beside the majors one per line
 * (`columns` 1), or under them `columns` to a row. Widths are the chip's border box: `label` the
 * widest label on one line, `word` the widest single word, `row` the panel's inner width.
 */
export interface MinorChips {
    beside: boolean
    columns: number
    width: number
}

/** A row's width shared by `columns` chips. */
function share(row: number, columns: number): number {
    return Math.floor((row - (columns - 1) * CHIP_GAP) / columns)
}

/** As many chips of `width` as a row holds, at least one and no more than there are. */
function perRow(row: number, width: number, count: number): number {
    return Math.max(1, Math.min(count, Math.floor((row + CHIP_GAP) / (width + CHIP_GAP))))
}

/**
 * A phone held upright: beside the majors, one per line at the column's width (no wider than the
 * widest label), while the column holds the longest word; where it cannot (a narrow phone), under
 * them, every chip the widest label's width, as many to a row as fit.
 */
export function uprightChips(
    sizes: { row: number; majors: number; label: number; word: number },
    count: number
): MinorChips {
    const column = sizes.row - sizes.majors - BESIDE_GAP
    if (column >= sizes.word) {
        return { beside: true, columns: 1, width: Math.floor(Math.min(sizes.label, column)) }
    }
    const width = Math.floor(Math.min(sizes.label, sizes.row))
    return { beside: false, columns: perRow(sizes.row, width, count), width }
}

/**
 * A phone held sideways: under the majors, as many to a row as keep the longest word whole, each
 * that share of the row, no wider than the widest label.
 */
export function sidewaysChips(
    sizes: { row: number; label: number; word: number },
    count: number
): MinorChips {
    let columns = 1
    for (let more = 2; more <= count && share(sizes.row, more) >= sizes.word; more++) {
        columns = more
    }
    const width = Math.floor(Math.min(sizes.label, share(sizes.row, columns)))
    return { beside: false, columns, width }
}
