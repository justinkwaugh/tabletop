import * as Type from 'typebox'
import { DateType } from '../../util/typebox.js'
import { GameState } from '../model/gameState.js'
import { Hydratable } from '../../util/hydration.js'
import { MachineContext } from './machineContext.js'
import * as Value from 'typebox/value'

export enum ActionSource {
    User = 'user',
    System = 'system'
}

export type PatchOperation = Type.Static<typeof PatchOperation>
export const PatchOperation = Type.Object({
    op: Type.String(),
    path: Type.String(),
    from: Type.Optional(Type.String()),
    value: Type.Optional(Type.Any())
})

export type Patch = Type.Static<typeof Patch>
export const Patch = Type.Array(PatchOperation)

export type GameAction = Type.Static<typeof GameAction>
export const GameAction = Type.Object({
    id: Type.String(),
    gameId: Type.String(),
    source: Type.Enum(ActionSource),
    type: Type.String(),
    playerId: Type.Optional(Type.String()),
    undoPatch: Type.Optional(Patch),
    index: Type.Optional(Type.Number()),
    simultaneousGroupId: Type.Optional(Type.String()),
    revealsInfo: Type.Optional(Type.Boolean()),
    createdAt: Type.Optional(DateType()),
    updatedAt: Type.Optional(DateType())
})

export type PlayerAction = Type.Static<typeof PlayerAction>
export const PlayerAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            playerId: Type.String()
        })
    ])
)

export const ToAPIAction = (schema: Type.TSchema) =>
    Type.Evaluate(
        Type.Intersect([
            Type.Omit(schema, ['createdAt', 'updatedAt']),
            Type.Object({
                createdAt: Type.Optional(Type.String({ format: 'date-time' })),
                updatedAt: Type.Optional(Type.String({ format: 'date-time' }))
            })
        ])
    )

export interface HydratedAction extends GameAction {
    apply(state: GameState, context?: MachineContext): void
    dehydrate(): GameAction
}

export abstract class HydratableAction<T extends Type.TSchema>
    extends Hydratable<T>
    implements HydratedAction
{
    declare id: string
    declare gameId: string
    declare source: ActionSource
    declare index: number
    declare type: string
    declare playerId?: string
    declare undoPatch?: Patch
    declare simultaneousGroupId?: string
    declare revealsInfo?: boolean
    declare createdAt?: Date
    declare updatedAt?: Date

    abstract apply(state: GameState, context?: MachineContext): void
}

export function createAction<T extends Type.TSchema>(schema: T, data?: Partial<Type.Static<T>>): Type.Static<T> {
    // Create a new action with dummy values/defaults
    const newAction = Value.Create(schema)

    if (data) {
        Object.assign(newAction, data)
    }

    // Validate the action
    Value.Assert(schema, newAction)
    return newAction
}
