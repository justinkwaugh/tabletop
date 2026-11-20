import { assertExists } from '@tabletop/common'
import { KnightRowIds, type KnightRowId } from '../data/guilds.js'
import type { FeudumGameState } from './gameState.js'
import type { KnightRow, KnightRowOwner } from './guildsState.js'

/** R-1.3 A row in play, with its id. */
export interface KnightRowEntry {
    readonly rowId: KnightRowId
    readonly row: KnightRow
}

/** Anything holding the Knight rows, a whole state or the guilds alone. */
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

/** R-1.4-H1 A seat's own row. */
export function seatKnightRow(
    state: KnightRowsHolder,
    playerId: string
): KnightRowEntry | undefined {
    return knightRows(state).find(({ row }) => rowSeat(row.owner) === playerId)
}

/** R-1.4.2 How many of the owner's markers the general supply holds. */
export function ownerSupply(state: SupplyHolder, owner: KnightRowOwner): number {
    return 'playerId' in owner
        ? (state.supply.influence[owner.playerId] ?? 0)
        : (state.supply.dummyInfluence[owner.dummyColour] ?? 0)
}

/** R-1.4.2 The owner's markers into (positive) or out of (negative) the general supply. */
export function changeOwnerSupply(
    state: SupplyHolder,
    owner: KnightRowOwner,
    change: number
): void {
    const counts = 'playerId' in owner ? state.supply.influence : state.supply.dummyInfluence
    const key = 'playerId' in owner ? owner.playerId : owner.dummyColour
    counts[key] = (counts[key] ?? 0) + change
}
