import * as Type from 'typebox'
import { ActionSource, type GameAction } from './gameAction.js'

export function getActionCascadeEndIndex(
    actions: readonly GameAction[],
    actionIndex: number
): number {
    if (actionIndex < 0) return actionIndex
    let end = actionIndex
    while (end + 1 < actions.length && actions[end + 1].source === ActionSource.System) end += 1
    return end
}

function hasRequiredTrueLiteral(schema: Type.TSchema | undefined, key: string): boolean {
    if (schema === undefined || !Type.IsObject(schema)) return false
    const marker: unknown = schema.properties[key]
    return (
        Type.IsLiteral(marker) &&
        marker.const === true &&
        Array.isArray(schema.required) &&
        schema.required.includes(key)
    )
}

export function isOutOfTurnActionType(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    type: string
): boolean {
    return hasRequiredTrueLiteral(apiActions[type], 'outOfTurn')
}

export function isSupersedableActionType(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    type: string
): boolean {
    return hasRequiredTrueLiteral(apiActions[type], 'supersedable')
}

export function standingActionAtTail(
    recentActions: readonly GameAction[],
    declaration: Pick<GameAction, 'playerId' | 'type'>
): GameAction | undefined {
    const last = recentActions.at(-1)
    return last?.source === ActionSource.User &&
        last.playerId === declaration.playerId &&
        last.type === declaration.type
        ? last
        : undefined
}

export function findStandingAction(
    actions: readonly GameAction[],
    declaration: Pick<GameAction, 'playerId' | 'type'>
): GameAction | undefined {
    return actions.findLast(
        (action) =>
            action.source === ActionSource.User &&
            action.playerId === declaration.playerId &&
            action.type === declaration.type
    )
}

export function unnamedDuplicateReason(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    recentActions: readonly GameAction[],
    action: GameAction
): string | undefined {
    if (action.supersedesActionId !== undefined) return undefined
    if (!isSupersedableActionType(apiActions, action.type)) return undefined
    return standingActionAtTail(recentActions, action)
        ? 'a declaration of this type already stands and must be named to be replaced'
        : undefined
}
