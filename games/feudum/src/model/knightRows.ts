import { assert, assertExists, type Color } from '@tabletop/common'
import { KnightRowIds, type KnightRowId } from '../data/guilds.js'
import { FeudumColors } from '../definition/colors.js'
import type { FeudumGameState } from './gameState.js'
import type { KnightRow, KnightRowOwner } from './guildsState.js'

/** R-1.3 A row in play, with its id. */
export interface KnightRowEntry {
    readonly rowId: KnightRowId
    readonly row: KnightRow
}

export interface KnightRowsHolder {
    readonly guilds: { readonly knight: Pick<FeudumGameState['guilds']['knight'], 'rows'> }
}
type SupplyHolder = Pick<FeudumGameState, 'supply'>

/** R-1.3 The rows in play, in the order of their ids: the seats' rows, then the dummy rows. */
export function knightRows(state: KnightRowsHolder): KnightRowEntry[] {
    return KnightRowIds.flatMap((rowId) => {
        const row = state.guilds.knight.rows[rowId]
        return row ? [{ rowId, row }] : []
    })
}

/** R-1.3 A row in play, by its id. */
export function knightRow(state: KnightRowsHolder, rowId: KnightRowId): KnightRow {
    const row = state.guilds.knight.rows[rowId]
    assertExists(row, `R-1.3 Knight row ${rowId} is in play`)
    return row
}

/** R-1.4-H1 The seat whose row this is; a dummy row has none. */
export function rowSeat(owner: KnightRowOwner): string | undefined {
    return 'playerId' in owner ? owner.playerId : undefined
}

/** R-1.4-H1 */
export function seatKnightRow(
    state: KnightRowsHolder,
    playerId: string
): KnightRowEntry | undefined {
    return knightRows(state).find(({ row }) => rowSeat(row.owner) === playerId)
}

/** R-1.4.2 How many of the row owner's markers the general supply holds. */
export function ownerSupply(state: SupplyHolder, { rowId, row }: KnightRowEntry): number {
    return 'playerId' in row.owner
        ? (state.supply.influence[row.owner.playerId] ?? 0)
        : (state.supply.dummyInfluence[rowId] ?? 0)
}

/** R-1.4.2 The row owner's markers into (positive) or out of (negative) the general supply. */
export function changeOwnerSupply(
    state: SupplyHolder,
    { rowId, row }: KnightRowEntry,
    change: number
): void {
    const counts = 'playerId' in row.owner ? state.supply.influence : state.supply.dummyInfluence
    const key = 'playerId' in row.owner ? row.owner.playerId : rowId
    counts[key] = (counts[key] ?? 0) + change
}

/** R-1.4-H1 A dummy row's printed colour, for presentation: the unused colours, in order, by row. */
export function dummyRowColour(
    state: KnightRowsHolder & { readonly players: readonly { readonly color: Color }[] },
    rowId: KnightRowId
): Color {
    const unused = FeudumColors.filter(
        (colour) => !state.players.some((player) => player.color === colour)
    )
    const dummies = knightRows(state).filter(({ row }) => !rowSeat(row.owner))
    const index = dummies.findIndex((entry) => entry.rowId === rowId)
    assert(index >= 0, `R-1.4-H1 Knight row ${rowId} is a dummy row`)
    const colour = unused.at(index)
    assertExists(colour, `R-1.4-H1 A colour is unused for Knight row ${rowId}`)
    return colour
}
