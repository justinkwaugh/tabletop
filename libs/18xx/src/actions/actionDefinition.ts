import { assert, type GameAction, type HydratedAction } from '@tabletop/common'
import type * as Type from 'typebox'

export type ActionDefinition = {
    type: string
    schema: Type.TSchema
    hydrate(action: GameAction): HydratedAction | undefined
}

export function defineAction<Action extends GameAction>(
    schema: Type.TObject<{ type: Type.TLiteral<string> }>,
    is: (action: GameAction) => action is Action,
    hydrate: (action: Action) => HydratedAction
): ActionDefinition {
    return {
        type: schema.properties.type.const,
        schema,
        hydrate: (action) => (is(action) ? hydrate(action) : undefined)
    }
}

export class ActionRegistry {
    private readonly definitions = new Map<string, ActionDefinition>()
    constructor(definitions: readonly ActionDefinition[]) {
        for (const definition of definitions) {
            assert(!this.definitions.has(definition.type), `Duplicate action ${definition.type}`)
            this.definitions.set(definition.type, definition)
        }
    }
    get schemas(): Record<string, Type.TSchema> {
        return Object.fromEntries(
            [...this.definitions.values()].map((definition) => [definition.type, definition.schema])
        )
    }
    hydrate(action: GameAction): HydratedAction | undefined {
        return this.definitions.get(action.type)?.hydrate(action)
    }
}
