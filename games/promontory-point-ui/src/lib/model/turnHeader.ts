import { MachineState } from '@tabletop/promontory-point'
import { currentTurnPlayerId } from './seatView.js'
import type { PromontoryPointGameSession } from './session.svelte.js'

export type TurnHeaderSource = Pick<
    PromontoryPointGameSession,
    'isViewingHistory' | 'gameState' | 'decidingPlayerId' | 'getPlayerName'
>

export type TurnHeaderView = {
    // The tab at the left end (game UI layout, "Turn header").
    heading: string
    // The short line beside it.
    info: string
}

// Game UI layout, "Turn header": whose turn it is, "History" in History View, "End of game" once
// the game has a result; beside it, who is doing what.
export function turnHeader(source: TurnHeaderSource): TurnHeaderView {
    const state = source.gameState
    if (source.isViewingHistory) {
        return { heading: 'History', info: 'an earlier moment of the game' }
    }
    if (state.result) {
        return { heading: 'End of game', info: 'final score' }
    }
    const activeId = state.activePlayerIds.at(0)
    const heading =
        source.decidingPlayerId !== undefined
            ? 'Your turn'
            : activeId === undefined
              ? ''
              : `${source.getPlayerName(activeId)}'s turn`
    return { heading, info: turnInfo(source) }
}

// R-2.2, R-4.3: the turn player and how far the turn has come, or the seat paying Repairs.
function turnInfo(source: TurnHeaderSource): string {
    const state = source.gameState
    const turnPlayerId = currentTurnPlayerId(state)
    const turn = state.turn
    if (turnPlayerId === undefined || turn === undefined) return ''
    if (state.machineState === MachineState.PayingRepairs) {
        const debtorId = state.pendingRepairs?.debtors[0]?.playerId
        return debtorId === undefined ? '' : `${source.getPlayerName(debtorId)} · paying Repairs`
    }
    const name = source.getPlayerName(turnPlayerId)
    if (state.machineState === MachineState.TradingAfterPlacing) {
        return `${name} · pieces placed`
    }
    const placements = turn.placementsMade + turn.placementsLeft
    return `${name} · placing ${Math.min(turn.placementsMade + 1, placements)} of ${placements}`
}
