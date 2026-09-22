import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'

export function tableHeaderState(session: EighteenXXSession) {
    if (!session.isViewingHistory && session.isMyTurn) return session.gameState
    return session.history.visibleContext.state
}
