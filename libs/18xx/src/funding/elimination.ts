import type * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, type Owner } from '../finance/finance.js'
import type { OperatingState } from '../operating/operatingSet.js'
import type { Debt } from './cashCrisis.js'

export type EliminationState = OperatingState

/**
 * A title's disposal of a bankrupt player's holdings, recorded in the bankruptcy Action under the
 * title's own schema. The family then surrenders the player's cash to their creditor, removes
 * them from play and records them among the bankrupt players.
 */
export interface EliminationRules<Changes extends Type.TObject = Type.TObject> {
    schema: Changes
    /**
     * `settling` is the crisis debt the bankruptcy ends and where play would have resumed, as
     * 1856's unredeemed loans stay on their company; absent for a failed train purchase.
     */
    eliminate(
        state: EliminationState,
        playerId: string,
        settling?: { debt: Debt; continuation: string }
    ): Type.Static<Changes>
}

export type Elimination = { changes: Type.Static<Type.TObject>; surrendered?: CashPayment }

export function eliminatePlayer(
    state: EliminationState,
    playerId: string,
    rules: EliminationRules,
    creditor: Owner,
    settling?: { debt: Debt; continuation: string }
): Elimination {
    const changes = rules.eliminate(state, playerId, settling)
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
