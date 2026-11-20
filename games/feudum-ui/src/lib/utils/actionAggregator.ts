import { isCallGameAction, type GameAction, type Round } from '@tabletop/common'
import {
    ActionType,
    isAdvanceTurn,
    isBeginDawn,
    isDiscardWrit,
    isEndRound,
    isNourish,
    isNourishPawns,
    isRevealPouches,
    isRollProgressDie,
    isStartRound,
    type AdvanceTurn,
    type Epoch,
    type TriggeredEpoch
} from '@tabletop/feudum'
import { isOffTurnDiscard } from './decisionPress.js'

export type HistoryGroupKind = 'single' | 'hands' | 'turn' | 'nourishing' | 'progress' | 'dawn'

export interface HistoryGroup {
    readonly kind: HistoryGroupKind
    readonly id: string
    readonly playerId?: string
    readonly actions: readonly GameAction[]
    readonly firstIndex: number
    readonly lastIndex: number
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

/** R-4.10 A seat that answered Nourish makes the game's "nobody needed feeding" line false. */
export function linedActions({ kind, actions }: HistoryGroup): readonly GameAction[] {
    return kind === 'nourishing' && actions.some((action) => isNourish(action))
        ? actions.filter((action) => !gameFedNobody(action))
        : actions
}

export interface HistoryTable {
    readonly rounds: readonly Round[]
    readonly epoch: Epoch
}

/** R-4.11.2 One epoch at a time, so a dawn names the epoch before it. */
const EpochBefore: Readonly<Record<TriggeredEpoch, Epoch>> = { 2: 1, 3: 2, 4: 3, 5: 4 }

const GroupOfType: ReadonlyMap<string, HistoryGroupKind> = new Map([
    [ActionType.ChooseStartingGoods, 'single'],
    [ActionType.PlaceStartingPawn, 'single'],
    [ActionType.ScoreGame, 'single'],
    [ActionType.FinaliseHand, 'hands'],
    [ActionType.RevealPouches, 'hands'],
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
 * R-2.2, R-5-H1 (contract: Game log and history) From the Actions as the seat received them and
 * the public series: never a patch, never a hidden field.
 */
export function aggregateHistory(
    actions: readonly GameAction[],
    { rounds, epoch }: HistoryTable
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
    let turnSeat: string | undefined

    const add = (action: GameAction, index: number, kind: HistoryGroupKind) => {
        if (
            open?.kind === 'turn' &&
            kind === 'turn' &&
            !isDiscardWrit(action) &&
            open.actions.every(isDiscardWrit) &&
            open.actions[0].playerId !== action.playerId
        ) {
            // R-4.4-H5 Another seat's discards before a turn's first card stand alone.
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
            // R-4.4-H5 Another seat's discard is not part of the turn it falls in.
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
        if (isRevealPouches(action)) {
            // R-3.1-H1 The reveal closes the hands: the cards begin.
            selecting = false
            open = undefined
        }
    }

    return slots.map((slot) =>
        slot.kind === 'epoch' || slot.kind === 'round' ? slot : formed(slot)
    )
}
