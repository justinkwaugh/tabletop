import {
    FINAL_ROUND,
    MachineState,
    PlayerStatus,
    WinKind,
    citizensMeetingSuccessorGoal,
    endDieThreshold,
    isImperialPlayer,
    wakePhaseWin,
    warExhaustionWinner,
    type HydratedOathGameState
} from '@tabletop/oath'

/** The first win the table would produce as it stands, and the moment it comes. */
export type NextWin =
    | { when: 'wake'; playerId: string; kind: WinKind.Usurper | WinKind.Visionary }
    | { when: 'wakeAfterNext'; playerId: string }
    | { when: 'endDie'; playerId: string; kind: WinKind; round: number; threshold: number }
    | { when: 'finalRound'; playerId: string; kind: WinKind }

type Moment = { kind: 'wake'; playerId: string } | { kind: 'roundEnd'; round: number }

/** The Wakes still to come this round, then each round's end and the Wakes of the rounds after. */
function momentsAhead(state: HydratedOathGameState): Moment[] {
    const order = state.turnManager.turnOrder
    const current = state.turnManager.currentTurn()?.playerId
    // R-4.1.2 — a Wake still being resolved is ahead of its seat, not behind it.
    const wakePending = state.machineState === MachineState.WakePhase
    const later = order.slice(
        current === undefined ? 0 : order.indexOf(current) + (wakePending ? 0 : 1)
    )
    const moments: Moment[] = later.map((playerId) => ({ kind: 'wake', playerId }))
    for (let round = state.round; round <= FINAL_ROUND; round++) {
        if (round > state.round) {
            moments.push(...order.map((playerId): Moment => ({ kind: 'wake', playerId })))
        }
        moments.push({ kind: 'roundEnd', round })
    }
    return moments
}

/** R-3.3.1 — where the Chancellor would win, a Citizen meeting the Successor goal wins instead. */
function empireWinnerId(state: HydratedOathGameState): { playerId: string; kind: WinKind } {
    const [successor] = citizensMeetingSuccessorGoal(state)
    return successor
        ? { playerId: successor, kind: WinKind.Successor }
        : { playerId: state.chancellorId(), kind: WinKind.StableRegime }
}

/** R-3.1, R-3.2, R-3.3, R-3.4 and R-4.1.3, read from the displayed state alone. */
export function nextWin(state: HydratedOathGameState): NextWin | undefined {
    const holderId = state.oathkeeperPlayerId
    const imperialHolds = holderId !== undefined && isImperialPlayer(state, holderId)
    const exileHolds =
        holderId !== undefined &&
        !state.oathkeeperIsUsurper &&
        state.getPlayerState(holderId).status === PlayerStatus.Exile
    let flipped = false

    for (const moment of momentsAhead(state)) {
        if (moment.kind === 'wake') {
            const win = wakePhaseWin(state, moment.playerId)
            if (win && (win.kind === WinKind.Usurper || win.kind === WinKind.Visionary)) {
                return { when: 'wake', playerId: win.winnerPlayerId, kind: win.kind }
            }
            if (exileHolds && moment.playerId === holderId) {
                if (flipped) return { when: 'wakeAfterNext', playerId: holderId }
                flipped = true
            }
            continue
        }
        if (moment.round === FINAL_ROUND) {
            // R-3.4.2 — an Exile who turned Usurper at their Wake this round holds it at the end.
            if (flipped && holderId !== undefined) {
                return { when: 'finalRound', playerId: holderId, kind: WinKind.Usurper }
            }
            const win = warExhaustionWinner(state)
            return { when: 'finalRound', playerId: win.winnerPlayerId, kind: win.kind }
        }
        const threshold = endDieThreshold(moment.round)
        if (threshold !== undefined && imperialHolds) {
            return { when: 'endDie', ...empireWinnerId(state), round: moment.round, threshold }
        }
    }
    return undefined
}

function winsAs(kind: WinKind, isViewer: boolean): string {
    switch (kind) {
        case WinKind.Usurper:
            return 'as the Usurper'
        case WinKind.Visionary:
            return `with ${isViewer ? 'your' : 'their'} Vision`
        case WinKind.Successor:
            return 'as the Successor'
        case WinKind.StableRegime:
        case WinKind.WarExhaustion:
            return 'as the Oathkeeper'
    }
}

/** R-3.3 — the end die's printed odds for the round. */
function odds(threshold: number): string {
    return threshold === 6 ? 'on a 6' : `on a ${threshold} or more`
}

/** What follows the winner's name, in the viewer's person. */
export function nextWinPhrase(next: NextWin, isViewer: boolean): string {
    const wins = isViewer ? 'win' : 'wins'
    const their = isViewer ? 'your' : 'their'
    switch (next.when) {
        case 'wake':
            return `${wins} ${winsAs(next.kind, isViewer)} at ${their} next Wake`
        case 'wakeAfterNext':
            return `${isViewer ? 'become' : 'becomes'} the Usurper at ${their} next Wake and ${wins} at the one after`
        case 'endDie':
            return `${wins} ${winsAs(next.kind, isViewer)} if the end die ends the game after round ${next.round} (${odds(next.threshold)})`
        case 'finalRound':
            return `${wins} ${winsAs(next.kind, isViewer)} when round ${FINAL_ROUND} ends`
    }
}
