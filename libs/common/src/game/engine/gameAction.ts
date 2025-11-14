import { Type, type Static, type TSchema } from 'typebox'
import { DateType, IsoDate } from '../../util/typebox/customTypes.js'
import { GameState } from '../model/gameState.js'
import { Hydratable } from '../../util/hydration.js'
import { MachineContext } from './machineContext.js'

export enum ActionSource {
    User = 'user',
    System = 'system'
}

export type PatchOperation = Static<typeof PatchOperation>
export const PatchOperation = Type.Object({
    op: Type.String(),
    path: Type.String(),
    from: Type.Optional(Type.String()),
    value: Type.Optional(Type.Any())
})

export type Patch = Static<typeof Patch>
export const Patch = Type.Array(PatchOperation)

export type GameAction = Static<typeof GameAction>
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
    createdAt: Type.Optional(IsoDate),
    updatedAt: Type.Optional(IsoDate)
})

export type PlayerAction = Static<typeof PlayerAction>
export const PlayerAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            playerId: Type.String()
        })
    ])
)

export const ToAPIAction = (schema: TSchema) =>
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

export abstract class HydratableAction<T extends TSchema>
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
