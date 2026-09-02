import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import { GameAction } from '../engine/gameAction.js'
import type { Perspective, Projector, ProjectorOptions } from './valueProjector.js'
import { createProjector } from './valueProjector.js'

export type ActionSchemaRegistry = Readonly<Record<string, Type.TSchema>>

export interface ActionProjector {
    project(action: GameAction, perspective: Perspective): GameAction
}

type RegisteredAction<Schemas extends ActionSchemaRegistry> = Type.Static<Schemas[keyof Schemas]>

export type ActionProjectorOptions<Schemas extends ActionSchemaRegistry> = ProjectorOptions<
    RegisteredAction<Schemas>
>

class SchemaActionProjector<Schemas extends ActionSchemaRegistry> implements ActionProjector {
    private readonly actionValidator: Validator<Type.TProperties, typeof GameAction>
    private readonly projectors: Readonly<Record<string, Projector<Type.TSchema>>>

    constructor(actionSchemas: Schemas, options: ActionProjectorOptions<Schemas>) {
        this.actionValidator = Compile(GameAction)

        const projectors: Record<string, Projector<Type.TSchema>> = {}
        for (const actionType in actionSchemas) {
            const schema = actionSchemas[actionType]
            projectors[actionType] = createProjector(schema, options)
        }
        this.projectors = projectors
    }

    project(action: GameAction, perspective: Perspective): GameAction {
        const projector = this.projectors[action.type]
        if (projector === undefined) {
            throw Error(`No visibility schema registered for Action type "${action.type}"`)
        }

        const actionWithoutCanonicalUndo = structuredClone(action)
        delete actionWithoutCanonicalUndo.undoPatch

        const projected: unknown = projector.project(actionWithoutCanonicalUndo, perspective)
        if (!this.actionValidator.Check(projected)) {
            throw Error('Action visibility projection does not retain the GameAction contract')
        }
        return projected
    }
}

export function createActionProjector<Schemas extends ActionSchemaRegistry>(
    actionSchemas: Schemas,
    options: ActionProjectorOptions<Schemas> = {}
): ActionProjector {
    return new SchemaActionProjector(actionSchemas, options)
}
