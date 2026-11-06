import { assertExists } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import type { GuildId, MonsterId } from '../data/components.js'
import type { DiscId } from '../data/discs.js'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import type { CombatTarget } from '../model/flow.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { replaceLocationDisc } from '../model/locationDiscs.js'
import { drawWrits } from '../model/writDeck.js'
import { setUp } from './improving.js'
import { tableAtPlayingCards, type Table } from './table.js'

/** Where `tableAtHandSelection` stands every seat's first pawn. */
export const Battlefield: SpaceId = 'space.desert.3'

const AttackerHand: ActionCardKind[] = ['conquer', 'move', 'tax']
const DefenderHand: ActionCardKind[] = ['tax', 'guild']

export interface CombatTable {
    readonly table: Table
    readonly attackerId: string
    readonly defenderId: string
    readonly thirdId: string
}

/**
 * R-3.13.1 The seat asked holds Conquer; the next seat is the defender. Every seat's first pawn is
 * a farmer on `Battlefield`, as setup leaves them.
 */
export function tableAtCombat(
    defenderHand: ActionCardKind[] = DefenderHand,
    attackerHand: ActionCardKind[] = AttackerHand
): CombatTable {
    const table = tableAtPlayingCards(() => ({ cards: DefenderHand }))
    const attackerId = table.asked
    const [defenderId, thirdId] = table.order.filter((playerId) => playerId !== attackerId)
    const deal = (state: HydratedFeudumGameState, playerId: string, hand: ActionCardKind[]) => {
        const seat = state.getPlayerState(playerId)
        seat.hand = [...hand]
        seat.handCount = hand.length
    }
    setUp(table, (state) => {
        deal(state, attackerId, attackerHand)
        deal(state, defenderId, defenderHand)
    })
    return { table, attackerId, defenderId, thirdId }
}

/** R-4.8.2 A second or third pawn of the seat on the space, of this character. */
export function addPawn(
    state: HydratedFeudumGameState,
    playerId: string,
    character: GuildId = 'farmer',
    spaceId: SpaceId = Battlefield
): void {
    const pawn = state.getPlayerState(playerId).pawns.find((held) => !held.spaceId)
    assertExists(pawn, 'R-1.1 A pawn is in supply')
    pawn.spaceId = spaceId
    pawn.character = character
}

/** R-4.2.4 The seat holds the monster, its marker on the icon. */
export function giveMonster(
    state: HydratedFeudumGameState,
    playerId: string,
    monster: MonsterId,
    spaceId: SpaceId = Battlefield
): void {
    state.monsters[monster] = { playerId, spaceId }
    state.guilds.knight.monsterIcons[monster] = playerId
    state.getPlayerState(playerId).influenceSupply -= 1
}

/** R-3.9.1 The space shows a feudum its first marker rules. */
export function buildFeudum(
    state: HydratedFeudumGameState,
    rulerId: string,
    spaceId: SpaceId = Battlefield,
    discId: DiscId = 'disc.feudum.knight-1',
    guild: GuildId = 'knight'
): void {
    replaceLocationDisc(state, spaceId, discId, 'feudum', guild)
    placeMarker(state, rulerId, spaceId)
}

/** R-4.4 The seat holds this writ, drawn off the deck. */
export function holdWrit(state: HydratedFeudumGameState, playerId: string, writId: WritId): void {
    const deck = state.requireVault().writDeck
    const entry = deck.find((row) => row.writId === writId)
    assertExists(entry, `${writId} is in the deck`)
    entry.writId = deck[0].writId
    deck[0].writId = writId
    const player = state.getPlayerState(playerId)
    player.requireWrits().push(...drawWrits(state, 1))
    player.writCount += 1
}

/** R-4.8.2 Every good of this seat goes back, leaving it nothing to add to an attack. */
export function emptyGoods(state: HydratedFeudumGameState, playerId: string): void {
    const { goods } = state.getPlayerState(playerId)
    state.supply.haversack.saltpeter += goods.saltpeter
    goods.saltpeter = 0
}

export const PawnOf = (playerId: string, n: 1 | 2 | 3 = 1): CombatTarget => ({
    kind: 'pawn',
    playerId,
    n
})

/** R-3.13.1 Plays Conquer at the battlefield. */
export function conquer(
    { table, attackerId }: CombatTable,
    target: CombatTarget,
    extra: Record<string, unknown> = {}
) {
    return table.send(attackerId, {
        type: ActionType.Conquer,
        spaceId: Battlefield,
        target,
        ...extra
    })
}

/** R-3.14-H1 */
export function answer({ table, defenderId }: CombatTable, flipDefend = false) {
    return table.send(defenderId, {
        type: ActionType.AnswerAttack,
        revealsInfo: true,
        flipDefend
    })
}

/** R-4.8.2 */
export function commit(
    { table, attackerId }: CombatTable,
    input: { saltpeter?: number; weapons?: unknown[]; wildTiles?: unknown[] } = {}
) {
    return table.send(attackerId, {
        type: ActionType.CommitAttack,
        saltpeter: 0,
        weapons: [],
        ...input
    })
}
