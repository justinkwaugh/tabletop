import type { GameAction } from '@tabletop/common'
import {
    MachineState,
    isEndTurn,
    isRevealHand,
    type PromontoryPointProjectedState
} from '@tabletop/promontory-point'
import { describeAction, type DescriptionPart } from './actionDescription.js'

// One row of a turn's entry; a row by another seat (a debtor's payment) names that seat.
export type HistoryRow = {
    key: string
    action: GameAction
    playerId?: string
    parts: DescriptionPart[]
}

export type HistoryTurn = {
    key: string
    turnNumber: number
    playerId: string
    // R-2.1, R-2.1-H1: play is back at the starting seat; round counts those returns.
    opensRound: boolean
    round: number
    actions: GameAction[]
    rows: HistoryRow[]
    ended: boolean
    // R-4.3, R-4.3-H4: the debtor deciding now, while this turn waits on a Repairs payment.
    sellingPlayerId?: string
    lastAt?: Date
}

export type HistoryState = Pick<
    PromontoryPointProjectedState,
    'turnManager' | 'machineState' | 'pendingRepairs'
>

function newTurn(
    turnNumber: number,
    playerId: string,
    startingPlayerId: string | undefined,
    round: number
): HistoryTurn {
    const opensRound = playerId === startingPlayerId
    return {
        key: `turn-${turnNumber}`,
        turnNumber,
        playerId,
        opensRound,
        round: opensRound ? round + 1 : round,
        actions: [],
        rows: [],
        ended: false
    }
}

// R-2.1, R-2.2, R-5: one entry per turn, oldest first, each growing as its actions arrive.
// A turn opens with its RevealHand, except the first, which setup opens with no action;
// it closes with its EndTurn. Turn players and the starting seat come from the turn manager.
// With the history still loading (docs/request-performance.md) the actions start partway in,
// so the turns are counted back from the turn manager's last.
export function aggregateTurns(
    actions: readonly GameAction[],
    state: HistoryState,
    viewerId: string | undefined,
    historyComplete = true
): HistoryTurn[] {
    const { turnManager } = state
    const startingPlayerId = turnManager.turnOrder[0]
    const turnPlayerAt = (turnIndex: number, action?: GameAction) =>
        turnManager.series[turnIndex]?.playerId ?? action?.playerId ?? startingPlayerId

    const turns: HistoryTurn[] = []
    const firstPlayer = turnPlayerAt(0)
    if (historyComplete && firstPlayer !== undefined) {
        turns.push(newTurn(1, firstPlayer, startingPlayerId, 0))
    }

    const ordered = actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
    for (const action of ordered) {
        let turn = turns.at(-1)
        if (turn === undefined || turn.ended) {
            const playerId = isRevealHand(action)
                ? action.playerId
                : turnPlayerAt(turns.length, action)
            if (playerId === undefined) {
                continue
            }
            turn = newTurn(turns.length + 1, playerId, startingPlayerId, turn?.round ?? 0)
            turns.push(turn)
        }
        turn.actions.push(action)
        turn.lastAt = action.createdAt ?? turn.lastAt
        const parts = describeAction(action, viewerId)
        if (parts !== undefined) {
            turn.rows.push({
                key: action.id,
                action,
                ...(action.playerId !== undefined && action.playerId !== turn.playerId
                    ? { playerId: action.playerId }
                    : {}),
                parts
            })
        }
        if (isEndTurn(action)) {
            turn.ended = true
        }
    }

    if (!historyComplete) {
        renumberFromTheLast(turns, state)
    }

    const current = turns.at(-1)
    const debtor = state.pendingRepairs?.debtors[0]
    if (
        current !== undefined &&
        !current.ended &&
        state.machineState === MachineState.PayingRepairs &&
        debtor !== undefined
    ) {
        current.sellingPlayerId = debtor.playerId
    }
    return turns
}

// The last loaded turn is the turn manager's last; each earlier one takes its place before it.
function renumberFromTheLast(turns: HistoryTurn[], state: HistoryState) {
    const { series, turnOrder } = state.turnManager
    const startingPlayerId = turnOrder[0]
    const offset = Math.max(0, series.length - turns.length)
    let round = series
        .slice(0, offset)
        .filter((entry) => entry.playerId === startingPlayerId).length
    turns.forEach((turn, index) => {
        const turnNumber = offset + index + 1
        const playerId = series[offset + index]?.playerId ?? turn.playerId
        const opensRound = playerId === startingPlayerId
        round = opensRound ? round + 1 : round
        Object.assign(turn, {
            key: `turn-${turnNumber}`,
            turnNumber,
            playerId,
            opensRound,
            round
        })
    })
}

// Jump: the table as the turn ended (or as it stands, for the turn under way).
export function jumpIndex(turn: HistoryTurn): number | undefined {
    return turn.actions.at(-1)?.index
}

// Replay: the turn's whole span, its reveal to its end, payments included.
export function replaySpan(turn: HistoryTurn): { start: number; end: number } | undefined {
    const start = turn.actions[0]?.index
    const end = turn.actions.at(-1)?.index
    return start === undefined || end === undefined ? undefined : { start, end }
}
