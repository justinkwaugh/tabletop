import {
    ActionSource,
    assertExists,
    isCallGameAction,
    type CallGameAction,
    type GameAction,
    type Phase,
    type Round
} from '@tabletop/common'
import {
    PhaseName,
    RAILROAD_IDS,
    isEndBuilding,
    isEndGame,
    isEndRound,
    isFinishBuilding,
    isPassJourney,
    isPlaceLocomotive,
    isRideJourney,
    isSkipShare,
    isTakeShare,
    paymentTotal,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { PHASE_LABELS } from '$lib/model/actionArea.js'
import {
    FINISH_BUILDING_REASONS,
    bonusLabel,
    describeAction,
    routeText,
    type Description
} from './describeAction.js'
import { romanRound } from './marginTracks.js'

// The history panel's entries (docs/game-ui-layout.md, History panel): one per player turn, with
// round and phase interstitials from the managers' series and a line for each end of round.

export type HistoryTurnKind = 'share' | 'building' | 'journey' | 'pass'

export type HistoryTurn = {
    kind: 'turn'
    key: string
    turn: HistoryTurnKind
    playerId: string
    actions: GameAction[]
    firstIndex: number
    lastIndex: number
    // The table after the turn: its last action, or the end of the round or game it set off.
    settledIndex: number
    // A building turn grows as placements arrive and closes with EndBuilding or FinishBuilding.
    closed: boolean
}

export type HistoryPhase = {
    kind: 'phase'
    key: string
    round: number
    phase: PhaseName
    start: number
}

// The end of a round, the game's end, and a called game: lines between turns, not turns.
export type HistoryMilestone = {
    kind: 'milestone'
    key: string
    action: GameAction
    index: number
}

export type HistoryEntry = HistoryTurn | HistoryPhase | HistoryMilestone

function turnKindOf(action: GameAction): HistoryTurnKind | undefined {
    if (isTakeShare(action) || isSkipShare(action)) {
        return 'share'
    }
    if (isPlaceLocomotive(action) || isEndBuilding(action) || isFinishBuilding(action)) {
        return 'building'
    }
    if (isRideJourney(action)) {
        return 'journey'
    }
    if (isPassJourney(action)) {
        return 'pass'
    }
    return undefined
}

function isPhaseName(name: string): name is PhaseName {
    return Object.values<string>(PhaseName).includes(name)
}

// R-2.1: each phase opens under the round that holds its first action.
function phaseEntries(rounds: readonly Round[], phases: readonly Phase[]): HistoryPhase[] {
    return phases
        .toSorted((a, b) => a.start - b.start)
        .flatMap(({ name, start }) => {
            const round = rounds.findLast((candidate) => candidate.start <= start)
            if (!round || !isPhaseName(name)) {
                return []
            }
            const key = `phase-${round.number}-${name}-${start}`
            return [{ kind: 'phase', key, round: round.number, phase: name, start }]
        })
}

// A pure fold of the displayed actions, in index order, into entries in the same order.
export function historyEntries(
    actions: readonly GameAction[],
    rounds: readonly Round[],
    phases: readonly Phase[]
): HistoryEntry[] {
    const pendingPhases = phaseEntries(rounds, phases)
    const entries: HistoryEntry[] = []
    let building: HistoryTurn | undefined

    const openPhasesUpTo = (index: number) => {
        while (pendingPhases.length > 0 && pendingPhases[0].start <= index) {
            const phase = pendingPhases.shift()
            if (phase) {
                entries.push(phase)
            }
        }
    }

    const ordered = actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
    ordered.forEach((action, position) => {
        const index = action.index ?? position
        openPhasesUpTo(index)

        const turn = turnKindOf(action)
        if (turn === 'building' && action.playerId) {
            // R-3.2: one entry for the seat's whole building turn.
            if (!building || building.playerId !== action.playerId || building.closed) {
                building = {
                    kind: 'turn',
                    key: action.id,
                    turn,
                    playerId: action.playerId,
                    actions: [],
                    firstIndex: index,
                    lastIndex: index,
                    settledIndex: index,
                    closed: false
                }
                entries.push(building)
            }
            building.actions.push(action)
            building.lastIndex = index
            building.settledIndex = index
            building.closed = isEndBuilding(action) || isFinishBuilding(action)
            return
        }
        if (turn && action.playerId) {
            // R-3.1, R-3.3: a share (taken or skipped), a journey and a pass are one action each.
            entries.push({
                kind: 'turn',
                key: action.id,
                turn,
                playerId: action.playerId,
                actions: [action],
                firstIndex: index,
                lastIndex: index,
                settledIndex: index,
                closed: true
            })
            return
        }
        if (isEndRound(action) || isEndGame(action) || isCallGameAction(action)) {
            // R-2.5, R-6.1: a round's last journey or pass carries the end of the round.
            const previous = entries.at(-1)
            if (previous?.kind === 'turn' && !isCallGameAction(action)) {
                previous.settledIndex = index
            }
            entries.push({ kind: 'milestone', key: action.id, action, index })
        }
    })

    // A phase that has opened with no action yet still heads the list.
    openPhasesUpTo(Number.POSITIVE_INFINITY)
    return entries
}

// R-2.1: "Round V · Build".
export function phaseHeading(entry: HistoryPhase): string {
    return `Round ${romanRound(entry.round)} · ${PHASE_LABELS[entry.phase]}`
}

// R-3.2, R-4.3: "Ana built 3 ■ 2 ■ · Chicago $2 · Denver $5", with the reason when the
// turn ended by itself (R-3.2.3, R-3.2.4).
export function buildingTurnDescription(turn: HistoryTurn): Description {
    const placements = turn.actions.filter(isPlaceLocomotive)
    const counts: Partial<Record<RailroadId, number>> = {}
    for (const { railroadId } of placements) {
        counts[railroadId] = (counts[railroadId] ?? 0) + 1
    }
    // "2 ■ 1 ■": each railroad's count before its colour square, in railroad order.
    const railroads: Description = RAILROAD_IDS.flatMap((railroadId): Description => {
        const count = counts[railroadId]
        return count === undefined ? [] : [` ${count} `, { railroadId }]
    })
    const bonuses = placements.flatMap((placement) =>
        (placement.metadata?.bonuses ?? []).map((bonus) => ` · ${bonusLabel(bonus)}`)
    )
    const finish = turn.actions.find(isFinishBuilding)?.metadata
    // A turn that used up its placements needs no reason; one with nothing legal left says so.
    const reason =
        finish && finish.reason !== 'limit' ? [` · ${FINISH_BUILDING_REASONS[finish.reason]}`] : []
    if (placements.length === 0) {
        return [{ playerId: turn.playerId }, ' built nothing', ...reason]
    }
    return [{ playerId: turn.playerId }, ' built', ...railroads, ...bonuses, ...reason]
}

export function turnDescription(turn: HistoryTurn): Description {
    if (turn.turn === 'building') return buildingTurnDescription(turn)
    const [action] = turn.actions
    // R-3.3: a journey's row heads its route lines (journeyRoute) and payout table.
    if (isRideJourney(action) && action.metadata) {
        return [{ playerId: action.playerId }, ' made a journey:']
    }
    return describeAction(action)
}

export type JourneyRoute = { ends: string; cities: number; fare: number }

// R-3.3.5: "New York → Albany" and "4 total cities – Fare $4", the fare the rider's own.
export function journeyRoute(turn: HistoryTurn): JourneyRoute | undefined {
    const [action] = turn.actions
    if (!isRideJourney(action) || !action.metadata) return undefined
    const { cityIds, payments } = action.metadata
    const first = cityIds[0]
    const last = cityIds[cityIds.length - 1]
    const rider = payments.find((payment) => payment.playerId === action.playerId)
    assertExists(rider, `A journey pays its rider ${action.playerId}`)
    return {
        ends: routeText(first === last ? [first] : [first, last]),
        cities: cityIds.length,
        fare: rider.fare
    }
}

export type Payout = { playerId: string; amount: number }

// R-3.3.4, R-3.3.5: each seat a journey paid, fare and dividends together, most first.
export function journeyPayouts(turn: HistoryTurn): Payout[] {
    const [action] = turn.actions
    if (!isRideJourney(action) || !action.metadata) return []
    return action.metadata.payments
        .map((payment) => ({ playerId: payment.playerId, amount: paymentTotal(payment) }))
        .filter((payout) => payout.amount > 0)
        .toSorted((a, b) => b.amount - a.amount)
}

export type HistoryJump = { actionIndex: number; exact: boolean }

// docs/game-ui-layout.md, Jump and replay: jump on turns (the table after the turn, with the end of
// round it set off, but before the next seat's turn) and on round and phase lines (the table as the
// phase opened, or as the round ended). Each lands on its exact action.
export function jumpTarget(entry: HistoryEntry): HistoryJump | undefined {
    if (entry.kind === 'turn') {
        return { actionIndex: entry.settledIndex, exact: true }
    }
    if (entry.kind === 'phase') {
        return { actionIndex: entry.start - 1, exact: true }
    }
    return isEndRound(entry.action) ? { actionIndex: entry.index, exact: true } : undefined
}

export type HistoryReplay = { startIndex: number; endIndex: number }

// Replay only where the map moves: a building turn's placements and a journey's passenger. Shares,
// passes and the end of a round change only numbers.
export function replayRange(entry: HistoryEntry): HistoryReplay | undefined {
    if (entry.kind !== 'turn') {
        return undefined
    }
    const moves =
        entry.turn === 'journey' ||
        (entry.turn === 'building' && entry.actions.some(isPlaceLocomotive))
    return moves ? { startIndex: entry.firstIndex, endIndex: entry.lastIndex } : undefined
}

// The entry the displayed state ends in: the last turn, which in History View is the displayed one.
export function openEntryKey(entries: readonly HistoryEntry[]): string | undefined {
    return entries.findLast((entry) => entry.kind === 'turn')?.key
}

export type HistoryStep = { action: GameAction | undefined; consequences: GameAction[] }

// docs/game-ui-layout.md, History description: the History Step that led to the displayed state,
// its User Action and the System Actions it set off (a seat's FinishBuilding or SkipShare, the
// end of a round, the game's end).
export function historyStep(actions: readonly GameAction[]): HistoryStep {
    const ordered = actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
    const start = ordered.findLastIndex((action) => action.source !== ActionSource.System)
    if (start < 0) {
        return { action: undefined, consequences: ordered }
    }
    return { action: ordered[start], consequences: ordered.slice(start + 1) }
}

// One line of the History description: a called game is drawn by the platform's own
// description; every other action reads as its sentence.
export type HistoryStepLine =
    { kind: 'called'; action: CallGameAction } | { kind: 'sentence'; description: Description }

export function historyStepLine(action: GameAction): HistoryStepLine {
    return isCallGameAction(action)
        ? { kind: 'called', action }
        : { kind: 'sentence', description: describeAction(action) }
}
