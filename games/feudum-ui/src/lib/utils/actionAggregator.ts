import { isCallGameAction, type GameAction, type Round } from '@tabletop/common'
import {
    ActionType,
    isAdvanceTurn,
    isBeginDawn,
    isDiscardWrit,
    isEndRound,
    isFinaliseHand,
    isNourish,
    isNourishPawns,
    isRollProgressDie,
    isStartRound,
    type AdvanceTurn,
    type Epoch,
    type TriggeredEpoch
} from '@tabletop/feudum'
import { isOffTurnDiscard } from './decisionPress.js'

/** What a group of Actions is, for the log: `single` stands alone and grows by nothing. */
export type HistoryGroupKind = 'single' | 'hands' | 'turn' | 'nourishing' | 'progress' | 'dawn'

/** One entry of Actions, each exactly as this seat received it. */
export interface HistoryGroup {
    readonly kind: HistoryGroupKind
    /** Holds still as the entry grows. */
    readonly id: string
    /** The seat whose turn it is; only a turn has one. */
    readonly playerId?: string
    readonly actions: readonly GameAction[]
    /** The span a replay covers. */
    readonly firstIndex: number
    readonly lastIndex: number
    /** Where a jump lands, on the entries that have one. */
    readonly jumpIndex?: number
    readonly replays: boolean
}

/** R-4.11.2 An epoch's interstitial. */
export interface EpochDivider {
    readonly kind: 'epoch'
    readonly id: string
    readonly epoch: Epoch
}

/** R-2.2 A round's interstitial; a jump shows the table as it began. */
export interface RoundDivider {
    readonly kind: 'round'
    readonly id: string
    readonly round: number
    readonly jumpIndex: number
}

export type HistoryDivider = EpochDivider | RoundDivider
export type HistoryEntry = HistoryDivider | HistoryGroup

export function isHistoryGroup(entry: HistoryEntry): entry is HistoryGroup {
    return entry.kind !== 'epoch' && entry.kind !== 'round'
}

/**
 * R-4.10 The Actions of an entry that the log gives a line, in order. A seat that answered Nourish
 * fed or lost a pawn, so the game's own feeding, when it fed nobody, would say no pawn needed
 * feeding against it: that line is left out. The entry still holds the Action, and its span.
 */
export function linedActions({ kind, actions }: HistoryGroup): readonly GameAction[] {
    return kind === 'nourishing' && actions.some((action) => isNourish(action))
        ? actions.filter((action) => !gameFedNobody(action))
        : actions
}

/** The public facts the interstitials come from, and how many seats finalise a hand. */
export interface HistoryTable {
    readonly rounds: readonly Round[]
    readonly epoch: Epoch
    readonly seats: number
}

/** R-4.11.2 One epoch at a time, so a dawn names the epoch before it. */
const EpochBefore: Readonly<Record<TriggeredEpoch, Epoch>> = { 2: 1, 3: 2, 4: 3, 5: 4 }

/** Actions that always open or join this kind of entry, whatever is open. */
const GroupOfType: ReadonlyMap<string, HistoryGroupKind> = new Map([
    [ActionType.ChooseStartingGoods, 'single'],
    [ActionType.PlaceStartingPawn, 'single'],
    [ActionType.ScoreGame, 'single'],
    [ActionType.FinaliseHand, 'hands'],
    [ActionType.NourishPawns, 'nourishing'],
    [ActionType.Nourish, 'nourishing'],
    [ActionType.RollProgressDie, 'progress'],
    [ActionType.BeginDawn, 'dawn'],
    [ActionType.ReplenishMap, 'dawn'],
    [ActionType.ReplenishGuilds, 'dawn'],
    [ActionType.CollectLandscapes, 'dawn']
])

/** Contract, Replay: a turn with one of these moved something on the board. */
const TurnMovesTheBoard: ReadonlySet<string> = new Set([
    ActionType.Migrate,
    ActionType.Move,
    ActionType.Influence,
    ActionType.Improve,
    ActionType.TendLandscape,
    ActionType.Harvest,
    ActionType.Conquer,
    ActionType.StarveThePeople,
    ActionType.GuildAction,
    ActionType.Feast
])

function leftUnfedPawns(action: GameAction): boolean {
    if (isNourish(action)) {
        return (action.metadata?.returned.length ?? 0) > 0
    }
    return (
        isNourishPawns(action) &&
        (action.metadata?.fed.some(({ returned }) => returned.length > 0) ?? false)
    )
}

/** R-4.10, D11 The game's own feeding, when it fed no seat: on its own line it says nobody needed feeding. */
function gameFedNobody(action: GameAction): boolean {
    return isNourishPawns(action) && (action.metadata?.fed.length ?? 0) === 0
}

/** R-3.3-H1 The turn goes on: the seat's second card. */
function staysWithSeat({ metadata }: AdvanceTurn): boolean {
    return metadata?.outcome === 'second-card'
}

/** R-4.11.1 A die that wasn't rolled moved nothing. */
function rolledTheDie(action: GameAction): boolean {
    return isRollProgressDie(action) && (action.metadata?.faces.length ?? 0) > 0
}

function replays(kind: HistoryGroupKind, actions: readonly GameAction[]): boolean {
    switch (kind) {
        case 'turn':
            return actions.some(({ type }) => TurnMovesTheBoard.has(type))
        case 'nourishing':
            return actions.some(leftUnfedPawns)
        case 'progress':
            return actions.some(rolledTheDie)
        case 'dawn':
            return true
        case 'single':
        case 'hands':
            return false
    }
}

interface Forming {
    kind: HistoryGroupKind
    readonly actions: GameAction[]
    readonly firstIndex: number
    lastIndex: number
}

function formed({ kind, actions, firstIndex, lastIndex }: Forming): HistoryGroup {
    const playerId = kind === 'turn' ? actions[0].playerId : undefined
    return {
        kind,
        id: `${kind}-${firstIndex}`,
        ...(playerId ? { playerId } : {}),
        actions,
        firstIndex,
        lastIndex,
        ...(kind === 'turn' || kind === 'dawn' ? { jumpIndex: lastIndex } : {}),
        replays: replays(kind, actions)
    }
}

/**
 * R-2.2, R-5-H1 The log's entries, oldest first (contract: Game log and history). Reads the Actions as
 * the seat received them and the public series beside them: never a patch, never a hidden field.
 * `AdvanceTurn` and `StartRound` are bookkeeping and only mark where entries end: an `AdvanceTurn`
 * that leaves the turn with its seat ends nothing. `EndRound` joins whatever entry the round ended on.
 * Any seat may discard at any time, so a discard never makes a turn its seat's: one by another seat
 * than the turn's stands alone, between turns or in the middle of one.
 */
export function aggregateHistory(
    actions: readonly GameAction[],
    { rounds, epoch, seats }: HistoryTable
): HistoryEntry[] {
    const slots: (HistoryDivider | Forming)[] = []
    const firstDawn = actions.find(isBeginDawn)?.metadata?.epoch
    const opening = firstDawn ? EpochBefore[firstDawn] : epoch
    slots.push({ kind: 'epoch', id: `epoch-${opening}`, epoch: opening })

    const firstKnown = actions[0]?.index ?? 0
    let nextRound = rounds.findIndex(({ start }) => start >= firstKnown)
    let open: Forming | undefined
    let last: Forming | undefined
    let selecting = false
    let finalised = 0
    /** The seat the last AdvanceTurn gave the turn to; none in a round's first turn. */
    let turnSeat: string | undefined

    const add = (action: GameAction, index: number, kind: HistoryGroupKind) => {
        if (
            open?.kind === 'turn' &&
            kind === 'turn' &&
            !isDiscardWrit(action) &&
            open.actions.every(isDiscardWrit) &&
            open.actions[0].playerId !== action.playerId
        ) {
            // R-4.4-H5 The turn is its first card's seat's: another seat's discards before it stand alone.
            open.kind = 'single'
            open = undefined
        }
        if (open?.kind === kind && kind !== 'single') {
            open.actions.push(action)
            open.lastIndex = index
            return
        }
        const opened: Forming = { kind, actions: [action], firstIndex: index, lastIndex: index }
        last = opened
        slots.push(opened)
        open = kind === 'single' ? undefined : opened
    }

    for (const [position, action] of actions.entries()) {
        const index = action.index ?? position
        while (nextRound >= 0 && nextRound < rounds.length && rounds[nextRound].start <= index) {
            const { number, start } = rounds[nextRound]
            slots.push({ kind: 'round', id: `round-${number}`, round: number, jumpIndex: start })
            nextRound += 1
        }
        if (isCallGameAction(action)) {
            // A called game happens beside the table: it leaves the entry open.
            slots.push({
                kind: 'single',
                actions: [action],
                firstIndex: index,
                lastIndex: index
            })
            continue
        }
        const seat = open?.kind === 'turn' ? open.actions[0].playerId : turnSeat
        if (!selecting && seat !== undefined && isOffTurnDiscard(action, seat)) {
            // R-4.4-H5 Any seat may discard at any time: another seat's discard is not its turn, nor
            // part of the turn it falls in, which goes on growing after it.
            slots.push({
                kind: 'single',
                actions: [action],
                firstIndex: index,
                lastIndex: index
            })
            continue
        }
        if (isStartRound(action)) {
            selecting = true
            finalised = 0
            turnSeat = undefined
            open = undefined
            continue
        }
        if (isAdvanceTurn(action)) {
            turnSeat = action.metadata?.turnPlayerId
            if (!staysWithSeat(action)) {
                open = undefined
            }
            continue
        }
        if (isEndRound(action)) {
            const roundLast: Forming | undefined = open ?? last
            if (roundLast) {
                roundLast.actions.push(action)
                roundLast.lastIndex = index
            } else {
                add(action, index, 'single')
            }
            open = undefined
            continue
        }
        if (isBeginDawn(action) && action.metadata) {
            const { epoch: dawning } = action.metadata
            slots.push({ kind: 'epoch', id: `epoch-${dawning}`, epoch: dawning })
        }

        add(
            action,
            index,
            GroupOfType.get(action.type) ?? (selecting ? 'hands' : (open?.kind ?? 'turn'))
        )
        if (isFinaliseHand(action)) {
            finalised += 1
            if (finalised >= seats) {
                selecting = false
                open = undefined
            }
        }
    }

    return slots.map((slot) =>
        slot.kind === 'epoch' || slot.kind === 'round' ? slot : formed(slot)
    )
}
