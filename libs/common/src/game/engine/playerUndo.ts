import { assertExists } from '../../util/assertions.js'
import { isOutOfTurnDeclaration } from './actionHistory.js'
import { ActionSource, type GameAction } from './gameAction.js'
import { CALL_GAME_ACTION_TYPE } from './callGame.js'

export enum PlayerUndoRestriction {
    CalledGame = 'calledGame',
    RevealsInformation = 'revealsInformation',
    OtherPlayersActions = 'otherPlayersActions'
}

type UndoAction = Pick<
    GameAction,
    | 'index'
    | 'type'
    | 'source'
    | 'playerId'
    | 'revealsInfo'
    | 'simultaneousGroupId'
    | 'outOfTurn'
    | 'sequenced'
>

export function isSameSimultaneousGroup(
    action: Pick<GameAction, 'simultaneousGroupId'>,
    other: Pick<GameAction, 'simultaneousGroupId'>
): boolean {
    return (
        action.simultaneousGroupId !== undefined &&
        other.simultaneousGroupId !== undefined &&
        action.simultaneousGroupId === other.simultaneousGroupId
    )
}

export function playerUndoRestriction(
    undoneActions: readonly UndoAction[],
    target: UndoAction,
    playerId: string
): PlayerUndoRestriction | undefined {
    for (const action of undoneActions) {
        if (action.type === CALL_GAME_ACTION_TYPE) return PlayerUndoRestriction.CalledGame
        if (action.revealsInfo) return PlayerUndoRestriction.RevealsInformation
        if (
            isOtherPlayersUserAction(action, playerId) &&
            !isSameSimultaneousGroup(action, target)
        ) {
            return PlayerUndoRestriction.OtherPlayersActions
        }
    }
    return undefined
}

export function latestPlayerUndoTarget<T extends UndoAction>(
    actions: readonly T[],
    playerId: string
): T | undefined {
    const position = actions.findLastIndex(
        (action) =>
            action.source === ActionSource.User &&
            action.playerId === playerId &&
            !isOutOfTurnDeclaration(action)
    )
    const target = actions[position]
    if (!target || playerUndoRestriction(actions.slice(position), target, playerId)) {
        return undefined
    }
    return target
}

export function playerUndoReach(
    actions: readonly UndoAction[],
    playerId: string
): number | undefined {
    let reach: number | undefined
    let remaining = actions
    for (
        let target = latestPlayerUndoTarget(remaining, playerId);
        target;
        target = latestPlayerUndoTarget(remaining, playerId)
    ) {
        assertExists(target.index, 'Undo reach requires indexed actions')
        reach = target.index
        remaining = remaining.slice(0, remaining.indexOf(target))
    }
    return reach
}

function isOtherPlayersUserAction(action: UndoAction, playerId: string): boolean {
    return (
        action.source === ActionSource.User &&
        !isOutOfTurnDeclaration(action) &&
        action.playerId !== undefined &&
        action.playerId !== playerId
    )
}
