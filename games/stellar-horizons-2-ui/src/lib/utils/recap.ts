import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, isEndTurn, isStartTurn } from '@tabletop/stellar-horizons-2'

// The turn's bookkeeping, which says nothing a player needs to read.
const QUIET: readonly string[] = [
    ActionType.StartPhase,
    ActionType.EndPhase,
    ActionType.SkipPhase,
    'tabletop.branch-close'
]

// What happens to everyone, worth reading whoever it names.
const SHARED: readonly string[] = [
    ActionType.StartTurn,
    ActionType.DrawEconomicTile,
    ActionType.RollInitiative,
    ActionType.DrawEvent,
    ActionType.ResolveEvent,
    ActionType.EndTurn
]

// A turn's start or end alone is not news: only what it brought (income, a roll, a goal reached).
function newsworthy(action: GameAction, playerId: string): boolean {
    if (isStartTurn(action)) {
        return (action.metadata?.income ?? 0) > 0 || names(action, playerId)
    }
    if (isEndTurn(action)) {
        const ended = action.metadata
        return (
            ended !== undefined &&
            (ended.endRoll !== undefined ||
                ended.truceRoll !== undefined ||
                ended.victorIds.length > 0 ||
                ended.gameOver ||
                (ended.eventEffects?.length ?? 0) > 0 ||
                (ended.releasedEvents?.length ?? 0) > 0)
        )
    }
    return true
}

// Whether an action names the player anywhere: as its player, or in its fields or its record.
function names(action: GameAction, playerId: string): boolean {
    if (action.playerId === playerId) return true
    const { undoPatch: _undo, forwardPatch: _forward, ...rest } = action
    return JSON.stringify(rest).includes(`"${playerId}"`)
}

/**
 * What a player should read on coming back to the table: the actions since their own last one
 * that happened without them (the turn's draws and rolls, which concern everyone, and the
 * results recorded for them) and other players' actions that name them (an attack on them, a
 * sale paying them). Nothing is read for a player who has not acted yet.
 */
export function recapActions(actions: readonly GameAction[], playerId: string): GameAction[] {
    const lastOwn = actions.findLastIndex(
        (action) => action.playerId === playerId && action.source === ActionSource.User
    )
    if (lastOwn < 0) return []
    return actions.slice(lastOwn + 1).filter((action) => {
        if (QUIET.includes(action.type)) return false
        if (action.source === ActionSource.System && SHARED.includes(action.type)) {
            return newsworthy(action, playerId)
        }
        return names(action, playerId)
    })
}

/** The actions still to read: those after the one last read, if it is among them. */
export function unreadRecap(
    recap: readonly GameAction[],
    lastReadId: string | undefined
): GameAction[] {
    const read =
        lastReadId === undefined ? -1 : recap.findIndex((action) => action.id === lastReadId)
    return recap.slice(read + 1)
}
