import {
    EighteenXXOperatingAction,
    EighteenXXPlayerAction,
    defineAction,
    type ActionDefinition
} from '@tabletop/18xx'
import { HydratableAction, type GameAction, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

type ActionSchema = Type.TObject<{ type: Type.TLiteral<string> }>

/** The schema, guard and hydrated base of one of the title's Actions. */
export interface TitleActionKit<Schema extends ActionSchema> {
    type: Schema['properties']['type']['const']
    schema: Schema
    is(action: GameAction): action is GameAction & Type.Static<Schema>
    /** Subclasses declare the stored fields they read, and add `apply`. */
    Base: abstract new (data: Type.Static<Schema>) => HydratableAction<Schema>
    define(hydrate: (action: Type.Static<Schema>) => HydratedAction): ActionDefinition
}

/** A player's Action of the title; `systemAction` makes the system's. */
export function titleAction<const Name extends string, Own extends Type.TProperties>(
    type: Name,
    own: Own
) {
    return actionKit(
        Type.Object(
            { ...EighteenXXPlayerAction.properties, type: Type.Literal(type), ...own },
            { additionalProperties: false }
        )
    )
}

/** The system's Actions, which may name the player they act for. */
export function systemAction<const Name extends string, Own extends Type.TProperties>(
    type: Name,
    own: Own
) {
    return actionKit(
        Type.Object(
            { ...EighteenXXOperatingAction.properties, type: Type.Literal(type), ...own },
            { additionalProperties: false }
        )
    )
}

function actionKit<Schema extends ActionSchema>(schema: Schema): TitleActionKit<Schema> {
    const validator = Compile(schema)
    const type = schema.properties.type.const
    abstract class Kit extends HydratableAction<Schema> {
        constructor(data: Type.Static<Schema>) {
            super(data, validator)
        }
    }
    const is = (action: GameAction): action is GameAction & Type.Static<Schema> =>
        action instanceof Kit || (action.type === type && validator.Check(action))
    return { type, schema, is, Base: Kit, define: (hydrate) => defineAction(schema, is, hydrate) }
}
