import { assert } from '@tabletop/common'
import { FinanceExampleValidator } from '@tabletop/18xx'
import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'

export function tableHeaderState(session: FinanceExampleSession) {
    if (!session.isViewingHistory && session.isMyTurn) return session.financialState
    const state = session.history.visibleContext.state
    assert(FinanceExampleValidator.Check(state), 'Round header requires financial state')
    return state
}
