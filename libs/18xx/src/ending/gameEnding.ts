import * as Type from 'typebox'
import type { GameState } from '@tabletop/common'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { canStartStockRound } from '../stock/startStockRound.js'
import type { Bankruptcy } from '../funding/trainFunding.js'
import type { ValuationRules } from './finalWealth.js'
import type { TrainState } from '../trains/train.js'

export const GameEnding = Type.Object(
    {
        reason: Type.String(),
        finalOperatingSet: Type.Optional(Type.Integer({ minimum: 1 })),
        finalOperatingRounds: Type.Optional(Type.Integer({ minimum: 1 })),
        /** The round of the final set the game ends after, cutting the set short (1862 §10.1). */
        finalOperatingRound: Type.Optional(Type.Integer({ minimum: 1 }))
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
export const BankBroken = 'Bank broken'
export function bankExhaustionAtSetEnd(state: OperatingState): GameEnding | undefined {
    if (!state.bank.broken) return undefined
    return {
        reason: BankBroken,
        finalOperatingSet:
            (state.operatingSet?.number ?? 0) +
            (!state.operatingSet || state.operatingSet.completed ? 1 : 0)
    }
}
export function endingDue(state: EndingState, rules: EndingRules): boolean {
    if (!state.gameEnding) return false
    if (state.gameEnding.finalOperatingSet === undefined) return true
    const set = state.operatingSet
    const { finalOperatingRound } = state.gameEnding
    return (
        state.machineState === 'OperatingSet' &&
        set?.number === state.gameEnding.finalOperatingSet &&
        (finalOperatingRound === undefined
            ? canStartStockRound(state)
            : set.roundNumber === finalOperatingRound &&
              set.privateIncomePaid &&
              !nextOperatingCompany(state)) &&
        !rules.roundPending?.(state)
    )
}
export function pendingEnding(state: EndingState, rules: EndingRules): GameEnding | undefined {
    const trigger = rules.trigger(state)
    if (!trigger) return undefined
    const current = state.gameEnding
    if (!current) return trigger
    if (current.finalOperatingSet === undefined) return undefined
    if (trigger.finalOperatingSet === undefined) return trigger
    if (trigger.finalOperatingSet !== current.finalOperatingSet)
        return trigger.finalOperatingSet < current.finalOperatingSet ? trigger : undefined
    // Within the same set, an ending after an earlier round replaces one at the set's end.
    return trigger.finalOperatingRound !== undefined &&
        (current.finalOperatingRound === undefined ||
            trigger.finalOperatingRound < current.finalOperatingRound)
        ? trigger
        : undefined
}
