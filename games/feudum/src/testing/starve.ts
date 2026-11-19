import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { moveConcealedSeal, type ImmunityRole } from '../model/seals.js'
import { returnGoodToHaversack, takeGoodFromHaversack } from '../model/supply.js'
import { addPawn, Battlefield, buildFeudum, tableAtCombat, type CombatTable } from './combat.js'
import { setUp } from './improving.js'

const ActorHand: ActionCardKind[] = ['conquer', 'move', 'tax']
const OwnerHand: ActionCardKind[] = ['defend', 'tax']

export interface StarveTable extends CombatTable {
    readonly role: ImmunityRole
}

/** R-3.14-H1 The seat's food goes back, so a Starve doesn't ask it. */
function noFood(state: HydratedFeudumGameState, playerId: string): void {
    const { goods } = state.getPlayerState(playerId)
    returnGoodToHaversack(state, 'food', goods.food)
    goods.food = 0
}

/** R-3.14.2 The seat takes one food off the haversack. */
export function giveFood(state: HydratedFeudumGameState, playerId: string): void {
    state.getPlayerState(playerId).goods.food += takeGoodFromHaversack(state, 'food')
}

/**
 * R-3.13.2 The seat asked holds Conquer and has a Noble on `Battlefield`, where the next seat
 * (`defenderId`) has a marker in this role: a serf under the actor's rule, or a subject of its own.
 */
export function tableAtStarve(
    role: ImmunityRole = 'serf',
    ownerHand: ActionCardKind[] = OwnerHand,
    actorHand: ActionCardKind[] = ActorHand
): StarveTable {
    const combat = tableAtCombat(ownerHand, actorHand)
    const { table, attackerId, defenderId } = combat
    setUp(table, (state) => {
        addPawn(state, attackerId, 'noble')
        buildFeudum(state, role === 'serf' ? attackerId : defenderId)
        placeMarker(state, defenderId, Battlefield)
        state.recomputeRanks()
        noFood(state, defenderId)
    })
    return { ...combat, role }
}

/** R-3.14.2 A pile seal lies under the owner's marker. */
export function sealUnder({ table, role }: StarveTable): void {
    setUp(table, (state) => {
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'immunity', spaceId: Battlefield, role })
    })
}

/** R-3.13.2 Plays Starve the People at the battlefield. */
export function starve(
    { table, attackerId, defenderId, role }: StarveTable,
    extra: Record<string, unknown> = {}
) {
    return table.send(attackerId, {
        type: ActionType.StarveThePeople,
        spaceId: Battlefield,
        targetPlayerId: defenderId,
        role,
        ...extra
    })
}

/** R-3.14.2, R-3.14-H1 */
export function answerStarve(
    { table, defenderId }: StarveTable,
    royalImmunity = false,
    extra: Record<string, unknown> = {}
) {
    return table.send(defenderId, {
        type: ActionType.AnswerStarve,
        revealsInfo: true,
        royalImmunity,
        ...extra
    })
}

/** R-3.14.2, R-3.14-H2 */
export function reclaim({ table, defenderId, role }: StarveTable, playerId = defenderId) {
    return table.send(playerId, {
        type: ActionType.ReclaimImmunitySeal,
        spaceId: Battlefield,
        role
    })
}
