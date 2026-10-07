import type * as Type from 'typebox'
import { ActionSource, type HydratedAction, type MachineContext } from '@tabletop/common'
import type { HydratedEighteenXXState } from './eighteenXXState.js'
import type { EighteenXXStateHandler } from './eighteenXXTitleRules.js'

type ActionSchema = Type.TObject<{ type: Type.TLiteral<string> }>

/**
 * Issues a system action, while one is due, before the wrapped state does anything else; the
 * action must carry the fields `due` names, and play moves to `next` after it when given.
 */
export class SystemActionFirstHandler<
    State extends HydratedEighteenXXState,
    Schema extends ActionSchema
> implements EighteenXXStateHandler<State> {
    constructor(
        private readonly handler: EighteenXXStateHandler<State>,
        private readonly schema: Schema,
        private readonly due: (state: State) => Partial<Type.Static<Schema>> | undefined,
        private readonly next?: string
    ) {}
    private owns(action: HydratedAction): boolean {
        return action.type === this.schema.properties.type.const
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (!this.owns(action)) return this.handler.isValidAction(action, context)
        const fields = this.due(context.gameState)
        return (
            action.source === ActionSource.System &&
            !!fields &&
            Object.entries(fields).every(([key, value]) => Reflect.get(action, key) === value)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<State>): void {
        const fields = this.due(context.gameState)
        if (fields) context.addSystemAction(this.schema, fields)
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.owns(action)
            ? (this.next ?? context.gameState.machineState)
            : this.handler.onAction(action, context)
    }
}
