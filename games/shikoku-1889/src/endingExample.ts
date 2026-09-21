import { assert } from '@tabletop/common'
import { prepareFinalOperatingTurn, type HydratedEighteenXXState } from '@tabletop/18xx'
export function prepareShikoku1889Ending(state: HydratedEighteenXXState): void {
    const bank = state.cash.find((cash) => cash.owner.kind === 'bank')
    assert(bank, 'The ending example requires a Bank')
    bank.amount = 'unlimited'
    state.bank.broken = true
    state.gameEnding = { reason: 'Bank broken', finalOperatingSet: 1 }
    prepareFinalOperatingTurn(state)
}
