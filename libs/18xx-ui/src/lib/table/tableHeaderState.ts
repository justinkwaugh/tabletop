import { assert } from '@tabletop/common'
import { EighteenXXStateValidator } from '@tabletop/18xx'
import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'

export function tableHeaderState(session: EighteenXXSession) {
    if (!session.isViewingHistory && session.isMyTurn) return session.financialState
    const state = session.history.visibleContext.state
    assert(EighteenXXStateValidator.Check(state), 'Round header requires financial state')
    return state
}
