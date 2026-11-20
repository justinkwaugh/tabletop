import { assertExists, type Color } from '@tabletop/common'
import {
    knightRow,
    seatKnightRow,
    type KnightRowsHolder,
    type KnightRowId,
    type KnightRowOwner
} from '@tabletop/feudum'

export interface SeatsAndRows {
    readonly players: readonly { readonly playerId: string; readonly color: Color }[]
    readonly guilds: KnightRowsHolder['guilds']
}

/** R-1.3 Its seat's colour's lane, or its dummy colour's; never whose row it is. */
export function rowLane(state: Pick<SeatsAndRows, 'players'>, owner: KnightRowOwner): Color {
    if ('dummyColour' in owner) {
        return owner.dummyColour
    }
    const seat = state.players.find(({ playerId }) => playerId === owner.playerId)
    assertExists(seat, `R-1.4-H1 ${owner.playerId} sits at the table`)
    return seat.color
}

/** R-1.3 The lane of a row in play, by its id. */
export function laneOfRow(state: SeatsAndRows, rowId: KnightRowId): Color {
    return rowLane(state, knightRow(state, rowId).owner)
}

/** R-1.4-H1 The id of a seat's own row. */
export function seatRowId(state: SeatsAndRows, playerId: string): KnightRowId | undefined {
    return seatKnightRow(state, playerId)?.rowId
}

export function knightMarkerPiece(rowId: KnightRowId, column: number): string {
    return `knight:${rowId}:${column}`
}
