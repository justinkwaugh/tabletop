import * as Type from 'typebox'
import type { GameState } from '@tabletop/common'
import type { OperatingState } from '../operating/operatingSet.js'
import { canStartStockRound } from '../stock/startStockRound.js'
import type { Bankruptcy } from '../funding/trainFunding.js'
import type { ValuationRules } from './finalWealth.js'

export const GameEnding = Type.Object(
    {
        reason: Type.String(),
        finalOperatingSet: Type.Optional(Type.Integer({ minimum: 1 }))
    },
    { additionalProperties: false }
)
export type GameEnding = Type.Static<typeof GameEnding>
export type EndingState = OperatingState &
    Pick<GameState, 'machineState'> & {
        bankruptcy?: Bankruptcy
        gameEnding?: GameEnding
    }
export interface EndingRules extends ValuationRules {
    trigger(state: EndingState): GameEnding | undefined
}
export function endingDue(state: EndingState): boolean {
    if (!state.gameEnding) return false
    if (state.gameEnding.finalOperatingSet === undefined) return true
    return (
        state.machineState === 'OperatingSet' &&
        state.operatingSet?.number === state.gameEnding.finalOperatingSet &&
        canStartStockRound(state)
    )
}
export function pendingEnding(state: EndingState, rules: EndingRules): GameEnding | undefined {
    const trigger = rules.trigger(state)
    if (!trigger) return undefined
    if (
        !state.gameEnding ||
        (trigger.finalOperatingSet === undefined &&
            state.gameEnding.finalOperatingSet !== undefined)
    )
        return trigger
    return undefined
}
