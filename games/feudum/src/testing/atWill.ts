import { assertExists } from '@tabletop/common'
import type { ActionCardKind } from '../data/cards.js'
import { Goods } from '../data/components.js'
import type { TileId } from '../data/regionTiles.js'
import { RegionIds } from '../data/regionTiles.js'
import type { WritId } from '../data/writs.js'
import { DiscardAnyTime } from '../actions/discardWrit.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { moveConcealedSeal } from '../model/seals.js'
import { collectTopTile } from '../model/regionStacks.js'
import { holdWrit } from './combat.js'
import { endCardTurn, type Table, tableAtHandSelection, tableAtPlayingCards } from './table.js'

/** R-4.4-H5 The fields every `DiscardWrit` carries. */
export const AnyTime = DiscardAnyTime

export const Weapon: WritId = 'writ.mandate.1'
/** A turn-in alternative for a vessel. */
export const VesselMandate: WritId = 'writ.mandate.2'
/** A turn-in alternative for shillings. */
export const ShillingMandate: WritId = 'writ.mandate.5'
/** A reward per guild: goods, shillings, a vessel. */
export const FarmerMandate: WritId = 'writ.mandate.6'
/** A reward per guild: influence, a seal, a bead. */
export const KnightMandate: WritId = 'writ.mandate.8'
export const Charter: WritId = 'writ.charter.monster-defeat'
export const Charters: readonly WritId[] = [
    Charter,
    'writ.charter.sulfur-barrel',
    'writ.charter.eastern-kingdom',
    'writ.charter.western-kingdom'
]

/** Every good of this seat back in the haversack, keeping totals. */
export function returnAllGoods(state: HydratedFeudumGameState, playerId: string): void {
    const { goods } = state.getPlayerState(playerId)
    for (const good of Goods) {
        state.supply.haversack[good] += goods[good]
        goods[good] = 0
    }
}

/** R-4.3.3 The seat collects a stack's top tile. */
export function giveTile(state: HydratedFeudumGameState, playerId: string): TileId {
    const region = RegionIds.find((id) => state.regionStacks[id].length > 0)
    assertExists(region, 'R-4.3.1 A stack has a tile')
    return collectTopTile(state, playerId, region).tile.id
}

/** R-4.4.3 The seat holds this charter sealed, a pile seal on it, as final scoring leaves it. */
export function holdSealedCharter(
    state: HydratedFeudumGameState,
    playerId: string,
    writId: WritId
): void {
    holdWrit(state, playerId, writId)
    const player = state.getPlayerState(playerId)
    const writs = player.requireWrits()
    writs.splice(writs.indexOf(writId), 1)
    player.requireSealedCharters().push(writId)
    moveConcealedSeal(state, { kind: 'pile' }, { kind: 'charter', playerId })
}

/** R-4.4-H1 The four at-will windows, and the state each stays in. */
export type WindowName = 'before a card' | 'hand selection' | 'nourishing' | 'writ limit'

export const WindowStates: Readonly<Record<WindowName, MachineState>> = {
    'before a card': MachineState.PlayingCards,
    'hand selection': MachineState.SelectingHands,
    nourishing: MachineState.Nourishing,
    'writ limit': MachineState.DiscardingWrits
}

const Hand: ActionCardKind[] = ['move', 'tax', 'guild']

/**
 * R-4.4-H1 A table in this window, with the seat it asks. `edit` runs first, so the seat holds what
 * a spec gives it when the handler asks. The writ limit's seat is over the limit by the off-deck
 * writs it gets from `fill`, with none of them sealed.
 */
export function tableInWindow(
    name: WindowName,
    edit: (state: HydratedFeudumGameState, playerId: string) => void = () => {}
): { table: Table; playerId: string } {
    const table =
        name === 'hand selection'
            ? tableAtHandSelection()
            : tableAtPlayingCards(() => ({ cards: Hand }))
    const playerId = table.asked
    table.moveTo((state) => {
        edit(state, playerId)
        if (name === 'nourishing') {
            endCardTurn(state)
            state.flow.nourish = { pending: [...state.turnManager.turnOrder] }
        }
        return WindowStates[name]
    })
    return { table, playerId }
}
