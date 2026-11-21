import { Color, type AxialCoordinates } from '@tabletop/common'
import type { PieceColor } from '@tabletop/dvonn'
import type { MoveEntry, PlaceEntry, PlayerEntry } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'space'; coords: AxialCoordinates }
    | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const space = (coords: AxialCoordinates): Segment => ({ kind: 'space', coords })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: PlayerEntry, brief = false): Segment[] {
    const passed = brief ? [] : passSegments(entry.passedPlayerId)
    switch (entry.kind) {
        case 'place':
            return [text(` placed ${pieceOf(entry)} on `), space(entry.coords), ...passed]
        case 'choose':
            return [text(` took ${COLOR_NAMES[entry.color]}`), ...passed]
        case 'move':
            return [...moveSegments(entry, brief), ...passed]
    }
}

function moveSegments(entry: MoveEntry, brief: boolean): Segment[] {
    const total = entry.moved + entry.landedOn
    if (brief) {
        return [
            text(` moved ${entry.moved} from `),
            space(entry.from),
            text(' onto '),
            space(entry.to),
            text(` (now ${total})`),
            ...(entry.removedPieces > 0 ? [text(`, cutting off ${entry.removedPieces}`)] : [])
        ]
    }
    return [
        text(` moved ${stackOf(entry.moved)} from `),
        space(entry.from),
        text(` onto ${entry.landedOnDvonn ? 'the DVONN piece' : stackOf(entry.landedOn)} on `),
        space(entry.to),
        text(`, making ${total}`),
        ...(entry.removedPieces > 0
            ? [
                  text(
                      `; ${count(entry.removedPieces, 'piece')} in ${count(entry.removedStacks, 'stack')} cut off and removed`
                  )
              ]
            : [])
    ]
}

const COLOR_NAMES: Record<PieceColor, string> = {
    [Color.White]: 'White',
    [Color.Black]: 'Black'
}

function pieceOf(entry: PlaceEntry): string {
    if (entry.dvonn) return 'a DVONN piece'
    return entry.color === undefined
        ? 'a piece'
        : `a ${COLOR_NAMES[entry.color].toLowerCase()} piece`
}

function passSegments(playerId: string | undefined): Segment[] {
    return playerId === undefined
        ? []
        : [text('; '), { kind: 'player', playerId }, text(' could not move and passed')]
}

function stackOf(height: number): string {
    return height === 1 ? 'a piece' : `a stack of ${height}`
}

function count(value: number, noun: string): string {
    return `${value} ${noun}${value === 1 ? '' : 's'}`
}
