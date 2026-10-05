import * as Type from 'typebox'
import type { GameState } from '@tabletop/common'
import type { OperatingState } from '../operating/operatingSet.js'
import { canStartStockRound } from '../stock/startStockRound.js'
import type { Bankruptcy } from '../funding/trainFunding.js'
import type { ValuationRules } from './finalWealth.js'
import type { TrainState } from '../trains/train.js'

export const GameEnding = Type.Object(
    {
        reason: Type.String(),
        finalOperatingSet: Type.Optional(Type.Integer({ minimum: 1 })),
        finalOperatingRounds: Type.Optional(Type.Integer({ minimum: 1 }))
    },
    { additionalProperties: false }
)
export type GameEnding = Type.Static<typeof GameEnding>
export type EndingState = OperatingState &
    TrainState &
    Pick<GameState, 'machineState'> & {
        bankruptcy?: Bankruptcy
        gameEnding?: GameEnding
    }
export interface EndingRules extends ValuationRules {
    trigger(state: EndingState): GameEnding | undefined
    /** Whether a round of the title's own is still to follow the final operating round. */
    roundPending?(state: EndingState): boolean
}
export function bankExhaustionAtSetEnd(state: OperatingState): GameEnding | undefined {
    if (!state.bank.broken) return undefined
    return {
        reason: 'Bank broken',
        finalOperatingSet:
            (state.operatingSet?.number ?? 0) +
            (!state.operatingSet || state.operatingSet.completed ? 1 : 0)
    }
}
export function endingDue(state: EndingState, rules: EndingRules): boolean {
    if (!state.gameEnding) return false
    if (state.gameEnding.finalOperatingSet === undefined) return true
    return (
        state.machineState === 'OperatingSet' &&
        state.operatingSet?.number === state.gameEnding.finalOperatingSet &&
        canStartStockRound(state) &&
        !rules.roundPending?.(state)
    )
}
export function pendingEnding(state: EndingState, rules: EndingRules): GameEnding | undefined {
    const trigger = rules.trigger(state)
    if (!trigger) return undefined
    if (
        !state.gameEnding ||
        (state.gameEnding.finalOperatingSet !== undefined &&
            (trigger.finalOperatingSet === undefined ||
                trigger.finalOperatingSet < state.gameEnding.finalOperatingSet))
    )
        return trigger
    return undefined
}
