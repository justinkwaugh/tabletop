import type * as Type from 'typebox'
import { ActionSource, type HydratedAction, type MachineContext } from '@tabletop/common'
import type { EighteenXXStateHandler, HydratedEighteenXXState } from '@tabletop/18xx'

type ActionSchema = Type.TObject<{ type: Type.TLiteral<string> }>

/**
 * Issues a system action, while one is due, before the wrapped state does anything else; the
 * action must carry the fields `due` names.
 */
export class SystemActionFirstHandler<
    Schema extends ActionSchema
> implements EighteenXXStateHandler {
    constructor(
        private readonly handler: EighteenXXStateHandler,
        private readonly schema: Schema,
        private readonly due: (
            state: HydratedEighteenXXState
        ) => Partial<Type.Static<Schema>> | undefined
    ) {}
    private owns(action: HydratedAction): boolean {
        return action.type === this.schema.properties.type.const
    }
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
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
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        const fields = this.due(context.gameState)
        if (fields) context.addSystemAction(this.schema, fields)
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return this.owns(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
