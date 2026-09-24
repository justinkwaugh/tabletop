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

export function findSupersededAction(
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

export type DeclaredSupersede =
    | { kind: 'none' }
    | { kind: 'replace'; superseded: GameAction }
    | { kind: 'invalid'; reason: string }

export function checkDeclaredSupersede(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    recentActions: readonly GameAction[],
    action: GameAction
): DeclaredSupersede {
    if (!isSupersedableActionType(apiActions, action.type))
        return action.supersedesActionId === undefined
            ? { kind: 'none' }
            : { kind: 'invalid', reason: `Actions of type ${action.type} cannot supersede` }
    const standing = findSupersededAction(recentActions, action)
    if (action.supersedesActionId === undefined)
        return standing
            ? {
                  kind: 'invalid',
                  reason: 'A declaration of this type already stands and must be named to be replaced'
              }
            : { kind: 'none' }
    return standing?.id === action.supersedesActionId
        ? { kind: 'replace', superseded: standing }
        : {
              kind: 'invalid',
              reason: 'The declaration being replaced is no longer the latest Action'
          }
}
