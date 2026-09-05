import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import * as Value from 'typebox/value'
import { GameAction } from '../engine/gameAction.js'
import {
    protect,
    redaction,
    type ProtectedSchema,
    type ProtectionOptions,
    type ReplacementRedaction
} from './visibilitySchema.js'
import type { Perspective, Projector, ProjectorOptions } from './valueProjector.js'
import { createProjectorWithRedactionAdapters } from './valueProjector.js'

export type ActionSchemaRegistry = Readonly<Record<string, Type.TSchema>>

export const RedactedActionType = 'tabletop.redacted-action' as const
const RedactedActionAdapter = 'tabletop.redacted-action' as const
const unavailableProjectedAction = Symbol.for(
    '@tabletop/common.visibility.unavailable-projected-action'
)

export class UnavailableProjectedActionError extends Error {
    constructor(readonly actionType: string) {
        super(`Projected execution cannot expose protected Action type "${actionType}"`)
        this.name = 'UnavailableProjectedActionError'
        Reflect.defineProperty(this, unavailableProjectedAction, { value: true })
    }
}

export function isUnavailableProjectedActionError(
    value: unknown
): value is UnavailableProjectedActionError {
    return (
        typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, unavailableProjectedAction) === true
    )
}

const RedactedActionEnvelope = Type.Object({
    id: GameAction.properties.id,
    gameId: GameAction.properties.gameId,
    source: GameAction.properties.source,
    type: Type.Literal(RedactedActionType),
    playerId: GameAction.properties.playerId,
    index: GameAction.properties.index,
    simultaneousGroupId: GameAction.properties.simultaneousGroupId,
    revealsInfo: GameAction.properties.revealsInfo,
    createdAt: GameAction.properties.createdAt,
    updatedAt: GameAction.properties.updatedAt
})

export function protectAction<Schema extends Type.TSchema, const PolicyName extends string>(
    schema: Schema,
    options: ProtectionOptions<PolicyName>
): ProtectedSchema<
    Schema,
    PolicyName,
    ReplacementRedaction<typeof RedactedActionAdapter, typeof RedactedActionEnvelope>
> {
    return protect(schema, {
        policy: options.policy,
        redaction: redaction.replaceWith(RedactedActionAdapter, RedactedActionEnvelope)
    })
}

export function isRedactedAction(action: GameAction): boolean {
    return action.type === RedactedActionType
}

const redactedActionEnvelopeProperties = new Set(Object.keys(RedactedActionEnvelope.properties))

export function redactActionRecord(value: unknown): GameAction {
    if (!Value.Check(GameAction, value)) {
        throw Error('Cannot redact a value that does not retain the GameAction contract')
    }

    const redacted = structuredClone(value)
    for (const property of Object.keys(redacted)) {
        if (!redactedActionEnvelopeProperties.has(property)) {
            Reflect.deleteProperty(redacted, property)
        }
    }
    redacted.type = RedactedActionType
    return redacted
}

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
        if (Object.hasOwn(actionSchemas, RedactedActionType)) {
            throw Error(`Game Action registry cannot use reserved type "${RedactedActionType}"`)
        }
        this.actionValidator = Compile(GameAction)

        const projectors: Record<string, Projector<Type.TSchema>> = {}
        for (const actionType in actionSchemas) {
            const schema = actionSchemas[actionType]
            projectors[actionType] = createProjectorWithRedactionAdapters(schema, options, {
                [RedactedActionAdapter]: (context) => redactActionRecord(context.value)
            })
        }
        this.projectors = projectors
    }

    project(action: GameAction, perspective: Perspective): GameAction {
        const projector = this.projectors[action.type]
        if (projector === undefined) {
            throw Error(`No visibility schema registered for Action type "${action.type}"`)
        }

        const actionWithoutCanonicalPatches = structuredClone(action)
        delete actionWithoutCanonicalPatches.undoPatch
        delete actionWithoutCanonicalPatches.forwardPatch

        const projected: unknown = projector.project(actionWithoutCanonicalPatches, perspective)
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
