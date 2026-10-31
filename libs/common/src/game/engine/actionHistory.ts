import * as Type from 'typebox'
import { ActionSource, type GameAction } from './gameAction.js'
import { CALL_GAME_ACTION_TYPE } from './callGame.js'

export function getActionCascadeEndIndex(
    actions: readonly GameAction[],
    actionIndex: number
): number {
    if (actionIndex < 0) return actionIndex
    let end = actionIndex
    while (end + 1 < actions.length && isCascadedSystemAction(actions[end + 1])) end += 1
    return end
}

export function isCascadedSystemAction(action: Pick<GameAction, 'source' | 'type'>): boolean {
    return action.source === ActionSource.System && action.type !== CALL_GAME_ACTION_TYPE
}

function requiredLiteral(schema: Type.TSchema | undefined, key: string): unknown {
    if (schema === undefined || !Type.IsObject(schema)) return undefined
    const marker: unknown = schema.properties[key]
    return Type.IsLiteral(marker) && Array.isArray(schema.required) && schema.required.includes(key)
        ? marker.const
        : undefined
}

function hasRequiredTrueLiteral(schema: Type.TSchema | undefined, key: string): boolean {
    return requiredLiteral(schema, key) === true
}

export function isOutOfTurnActionType(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    type: string
): boolean {
    return hasRequiredTrueLiteral(apiActions[type], 'outOfTurn')
}

export function isSequencedActionType(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    type: string
): boolean {
    return (
        isOutOfTurnActionType(apiActions, type) &&
        hasRequiredTrueLiteral(apiActions[type], 'sequenced') &&
        !isSupersedableActionType(apiActions, type)
    )
}

export function isOutOfTurnDeclaration(action: Pick<GameAction, 'outOfTurn' | 'sequenced'>) {
    return action.outOfTurn === true && action.sequenced !== true
}

/**
 * Whether the out-of-turn declaration at `position` still only stands: no System Action of its
 * cascade follows it. One that acted has dependents, so Undo treats it as a turn (ADR 0007).
 */
export function isStandingDeclaration(
    actions: readonly Pick<GameAction, 'outOfTurn' | 'sequenced' | 'source' | 'type'>[],
    position: number
): boolean {
    const action = actions[position]
    if (action === undefined || !isOutOfTurnDeclaration(action)) return false
    const next = actions[position + 1]
    return next === undefined || !isCascadedSystemAction(next)
}

export function isSupersedableActionType(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    type: string
): boolean {
    return hasRequiredTrueLiteral(apiActions[type], 'supersedable')
}

/**
 * Whether `earlier` is a declaration `declaration` may supersede: the same Player's User Action of
 * the same type and, when the type names a `supersessionScope` field, with the same value in it
 * (ADR 0008), so a Player keeps one standing declaration per scope, such as per company.
 */
export function supersedesSameDeclaration(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    declaration: GameAction,
    earlier: GameAction
): boolean {
    const scope = requiredLiteral(apiActions[declaration.type], 'supersessionScope')
    return (
        earlier.source === ActionSource.User &&
        earlier.playerId === declaration.playerId &&
        earlier.type === declaration.type &&
        (typeof scope !== 'string' ||
            Reflect.get(earlier, scope) === Reflect.get(declaration, scope))
    )
}

export function standingActionAtTail(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    recentActions: readonly GameAction[],
    declaration: GameAction
): GameAction | undefined {
    const last = recentActions.at(-1)
    return last && supersedesSameDeclaration(apiActions, declaration, last) ? last : undefined
}

export function findStandingAction(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    actions: readonly GameAction[],
    declaration: GameAction
): GameAction | undefined {
    return actions.findLast((action) => supersedesSameDeclaration(apiActions, declaration, action))
}

export function unnamedDuplicateReason(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    recentActions: readonly GameAction[],
    action: GameAction
): string | undefined {
    if (action.supersedesActionId !== undefined) return undefined
    if (!isSupersedableActionType(apiActions, action.type)) return undefined
    return standingActionAtTail(apiActions, recentActions, action)
        ? 'a declaration of this type already stands and must be named to be replaced'
        : undefined
}
