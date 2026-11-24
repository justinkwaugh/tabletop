import { assert, assertExists } from '@tabletop/common'
import type { ActionCardKind } from '../data/cards.js'
import { Goods } from '../data/components.js'
import type { TileId } from '../data/regionTiles.js'
import { RegionIds } from '../data/regionTiles.js'
import { Mandates, type MandateAlternativeId, type WritId } from '../data/writs.js'
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
export const VesselMandate: WritId = 'writ.mandate.2'
export const ShillingMandate: WritId = 'writ.mandate.5'
export const FarmerMandate: WritId = 'writ.mandate.6'
export const KnightMandate: WritId = 'writ.mandate.8'
export const Charter: WritId = 'writ.charter.monster-defeat'
export const Charters: readonly WritId[] = [
    Charter,
    'writ.charter.sulfur-barrel',
    'writ.charter.eastern-kingdom',
    'writ.charter.western-kingdom'
]

/** R-4.4.2 A turn-in mandate's printed alternative, first or second. */
export function alternativeOf(writId: WritId, printed: 1 | 2): MandateAlternativeId {
    const mandate = Mandates.find(({ id }) => id === writId)
    assert(mandate?.kind === 'turn-in', `${writId} prints no alternatives`)
    return mandate.alternatives[printed - 1].id
}

export function returnAllGoods(state: HydratedFeudumGameState, playerId: string): void {
    const { goods } = state.getPlayerState(playerId)
    for (const good of Goods) {
        state.supply.haversack[good] += goods[good]
        goods[good] = 0
    }
}

/** R-4.3.3 */
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

/** R-4.4-H1 A table in this window, with the seat it asks; `edit` runs before the handler asks. */
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
