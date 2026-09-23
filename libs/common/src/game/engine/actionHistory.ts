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

export function findSupersededOutOfTurnAction(
    recentActions: readonly GameAction[],
    action: GameAction
): GameAction | undefined {
    if (!action.outOfTurn) return undefined
    const last = recentActions.at(-1)
    return last?.source === ActionSource.User &&
        last.outOfTurn === true &&
        last.playerId === action.playerId &&
        last.type === action.type
        ? last
        : undefined
}

export function isOutOfTurnActionType(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    type: string
): boolean {
    const schema = apiActions[type]
    if (schema === undefined || !Type.IsObject(schema)) return false
    const marker: unknown = schema.properties.outOfTurn
    return (
        Type.IsLiteral(marker) &&
        marker.const === true &&
        Array.isArray(schema.required) &&
        schema.required.includes('outOfTurn')
    )
}
