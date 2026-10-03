import type { HydratedEighteenSeventeenState, EighteenSeventeenStateHandler } from './state.js'
import type * as Type from 'typebox'
import { ActionSource, type HydratedAction, type MachineContext } from '@tabletop/common'

type ActionSchema = Type.TObject<{ type: Type.TLiteral<string> }>

/**
 * Issues a system action, while one is due, before the wrapped state does anything else; the
 * action must carry the fields `due` names, and play moves to `next` after it when given.
 */
export class SystemActionFirstHandler<
    Schema extends ActionSchema
> implements EighteenSeventeenStateHandler {
    constructor(
        private readonly handler: EighteenSeventeenStateHandler,
        private readonly schema: Schema,
        private readonly due: (
            state: HydratedEighteenSeventeenState
        ) => Partial<Type.Static<Schema>> | undefined,
        private readonly next?: string
    ) {}
    private owns(action: HydratedAction): boolean {
        return action.type === this.schema.properties.type.const
    }
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenSeventeenState>
    ): boolean {
        if (!this.owns(action)) return this.handler.isValidAction(action, context)
        const fields = this.due(context.gameState)
        return (
            action.source === ActionSource.System &&
            !!fields &&
            Object.entries(fields).every(([key, value]) => Reflect.get(action, key) === value)
        )
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenSeventeenState>
    ): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<HydratedEighteenSeventeenState>): void {
        const fields = this.due(context.gameState)
        if (fields) context.addSystemAction(this.schema, fields)
        else this.handler.enter(context)
    }
    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenSeventeenState>
    ): string {
        return this.owns(action)
            ? (this.next ?? context.gameState.machineState)
            : this.handler.onAction(action, context)
    }
}
