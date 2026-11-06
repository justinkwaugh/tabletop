import { assertExists } from '@tabletop/common'
import type { ActionCardKind } from '../data/cards.js'
import type { TileId } from '../data/regionTiles.js'
import { RegionIds } from '../data/regionTiles.js'
import type { WritId } from '../data/writs.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { moveConcealedSeal } from '../model/seals.js'
import { collectTopTile } from '../model/regionStacks.js'
import { writRegistry } from '../writs/writRegistry.js'
import { holdWrit } from './combat.js'
import { tableAtHandSelection, tableAtPlayingCards, type Table } from './table.js'

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

/** R-4.4.2 Test registrations on the shared registry, for what the actions read from it. */
export function registerTestMandates(): void {
    const absent = (writId: WritId) => writRegistry.mandateAlternatives(writId).length === 0
    if (absent(VesselMandate)) {
        writRegistry.register({
            writId: 'writ.mandate.2',
            timing: 'at-will',
            printedText: 'Test: wood for a ship',
            alternatives: [
                {
                    turnedIn: ['wood'],
                    reward: { kind: 'vessel', vessel: 'ship' },
                    reveals: 'nothing'
                }
            ]
        })
    }
    if (absent(ShillingMandate)) {
        writRegistry.register({
            writId: 'writ.mandate.5',
            timing: 'at-will',
            printedText: 'Test: food for 3s, or 2 food for 8s',
            alternatives: [
                {
                    turnedIn: ['food'],
                    reward: { kind: 'shillings', amount: 3 },
                    reveals: 'nothing'
                },
                {
                    turnedIn: ['food', 'food'],
                    reward: { kind: 'shillings', amount: 8 },
                    reveals: 'nothing'
                }
            ]
        })
    }
    if (absent(FarmerMandate)) {
        writRegistry.register({
            writId: 'writ.mandate.6',
            timing: 'at-will',
            printedText: 'Test: 3 stars in a guild',
            alternatives: [
                {
                    turnedIn: [],
                    rewardGuild: 'farmer',
                    reward: { kind: 'goods', amount: 3 },
                    reveals: 'draw'
                },
                {
                    turnedIn: [],
                    rewardGuild: 'merchant',
                    reward: { kind: 'shillings', amount: 3 },
                    reveals: 'nothing'
                },
                {
                    turnedIn: [],
                    rewardGuild: 'alchemist',
                    reward: { kind: 'vessel', vessel: 'ship' },
                    reveals: 'nothing'
                }
            ]
        })
    }
    if (absent(KnightMandate)) {
        writRegistry.register({
            writId: 'writ.mandate.8',
            timing: 'at-will',
            printedText: 'Test: 3 stars in a guild',
            alternatives: [
                {
                    turnedIn: [],
                    rewardGuild: 'knight',
                    reward: { kind: 'influence', amount: 3 },
                    reveals: 'nothing'
                },
                {
                    turnedIn: [],
                    rewardGuild: 'noble',
                    reward: { kind: 'seal', amount: 1 },
                    reveals: 'nothing'
                },
                {
                    turnedIn: [],
                    rewardGuild: 'monk',
                    reward: { kind: 'bead', amount: 1 },
                    reveals: 'flip'
                }
            ]
        })
    }
    if (!writRegistry.weaponBonus(Weapon, 0)) {
        writRegistry.register({
            writId: 'writ.mandate.1',
            timing: 'attack',
            printedText: 'Test: bow for free',
            bonuses: [{ turnedIn: [], attack: 1 }]
        })
    }
}

/** R-4.3.3 The seat collects a stack's top tile. */
export function giveTile(state: HydratedFeudumGameState, playerId: string): TileId {
    const region = RegionIds.find((id) => state.regionStacks[id].length > 0)
    assertExists(region, 'R-4.3.1 A stack has a tile')
    return collectTopTile(state, playerId, region).tile.id
}

/** R-4.4.3 The seat holds this charter already sealed, a pile seal on it. */
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
            state.flow.turn = undefined
            state.flow.nourish = { pending: [...state.turnManager.turnOrder] }
        }
        return WindowStates[name]
    })
    return { table, playerId }
}
