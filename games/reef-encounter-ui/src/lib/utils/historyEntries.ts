import type { GameAction } from '@tabletop/common'
import { ActionType, isEatCoral, isEndGame, isPlayAlgaCylinder } from '@tabletop/reef-encounter'

export type HistoryEntry = {
    // The player whose turn or setup choice this is; absent for the game's end.
    playerId?: string
    actions: GameAction[]
}

const PieceMovingActions = new Set<string>([
    ActionType.PlacePolyp,
    ActionType.IntroduceShrimp,
    ActionType.MoveShrimp,
    ActionType.EatCoral,
    ActionType.PlayAlgaCylinder,
    ActionType.TakeOpenSeaSpace,
    ActionType.RefillOpenSea
])

const SetupActions = new Set<string>([ActionType.FeedParrotfish, ActionType.ChooseLarvaCubes])

export function isSetupEntry(entry: HistoryEntry): boolean {
    return entry.actions.every((action) => SetupActions.has(action.type))
}

export function movesPieces(entry: HistoryEntry): boolean {
    return entry.actions.some((action) => PieceMovingActions.has(action.type))
}

// One entry per stretch of actions by one player, with the system actions they caused (such as
// the open-sea refill) joining that player's entry; the game's end stands alone.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    for (const action of actions) {
        const current = entries.at(-1)
        const joinsCurrent =
            current !== undefined &&
            !isEndGame(action) &&
            (action.playerId === undefined || action.playerId === current.playerId)
        if (joinsCurrent) {
            current.actions.push(action)
            continue
        }
        entries.push({
            playerId: isEndGame(action) ? undefined : action.playerId,
            actions: [action]
        })
    }
    return entries
}

// The History Step: the last player action and the System Actions that followed it.
export function historyStep(actions: readonly GameAction[]): GameAction[] {
    const start = actions.findLastIndex((action) => action.playerId !== undefined)
    return actions.slice(Math.max(start, 0))
}

export function previousTurn(
    actions: readonly GameAction[],
    activePlayerIds: readonly string[]
): HistoryEntry | undefined {
    return historyEntries(actions).findLast(
        (entry) => entry.playerId !== undefined && !activePlayerIds.includes(entry.playerId)
    )
}

export function startsFinalTurns(action: GameAction): boolean {
    return (
        (isEatCoral(action) || isPlayAlgaCylinder(action)) &&
        action.metadata?.startsFinalTurns === true
    )
}

// The players' entries after the one whose action started the final turns.
export function finalTurnEntries(entries: readonly HistoryEntry[]): Set<HistoryEntry> {
    const start = entries.findIndex((entry) => entry.actions.some(startsFinalTurns))
    if (start < 0) return new Set()
    return new Set(entries.slice(start + 1).filter((entry) => entry.playerId !== undefined))
}
