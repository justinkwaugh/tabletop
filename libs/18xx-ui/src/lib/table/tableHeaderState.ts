import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

export function tableHeaderState(session: EighteenXXSessionView) {
    if (!session.isViewingHistory && session.isMyTurn) return session.gameState
    return session.history.visibleContext.state
}
