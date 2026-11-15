import type * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, type Owner } from '../finance/finance.js'
import type { OperatingState } from '../operating/operatingSet.js'

export type EliminationState = OperatingState

/**
 * A title's disposal of a bankrupt player's holdings, recorded in the bankruptcy Action under the
 * title's own schema. The family then surrenders the player's cash to their creditor, removes
 * them from play and records them among the bankrupt players.
 */
export interface EliminationRules<Changes extends Type.TObject = Type.TObject> {
    schema: Changes
    eliminate(state: EliminationState, playerId: string): Type.Static<Changes>
}

export type Elimination = { changes: Type.Static<Type.TObject>; surrendered?: CashPayment }

export function eliminatePlayer(
    state: EliminationState,
    playerId: string,
    rules: EliminationRules,
    creditor: Owner
): Elimination {
    const changes = rules.eliminate(state, playerId)
    const player = { kind: 'player' as const, playerId }
    const cash = finiteCashOwnedBy(state, player)
    const surrendered = cash ? { from: player, to: creditor, amount: cash } : undefined
    if (surrendered) settleCashPayments(state, [surrendered])
    state.bankruptPlayerIds = [...(state.bankruptPlayerIds ?? []), playerId]
    state.turnManager.turnOrder = state.turnManager.turnOrder.filter((id) => id !== playerId)
    state.stockRound.passedPlayerIds = state.stockRound.passedPlayerIds.filter(
        (id) => id !== playerId
    )
    return surrendered ? { changes, surrendered } : { changes }
}
