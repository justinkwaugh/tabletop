import {
    EighteenXXOperatingAction,
    EighteenXXPlayerAction,
    defineAction,
    type ActionDefinition
} from '@tabletop/18xx'
import { HydratableAction, type GameAction, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export type PlayerActionBase = typeof EighteenXXPlayerAction.properties
/** The system's Actions, which may name the player they act for. */
export type SystemActionBase = typeof EighteenXXOperatingAction.properties
export type TitleActionFields<
    Name extends string,
    Own extends Type.TProperties,
    Base extends Type.TProperties
> = Omit<Base, 'type'> & { type: Type.TLiteral<Name> } & Own
export type TitleActionSchema<
    Name extends string,
    Own extends Type.TProperties,
    Base extends Type.TProperties
> = Type.TObject<TitleActionFields<Name, Own, Base>>

/** The schema, guard and hydrated base of one of the title's Actions. */
export interface TitleActionKit<
    Name extends string,
    Own extends Type.TProperties,
    Base extends Type.TProperties
> {
    type: Name
    schema: TitleActionSchema<Name, Own, Base>
    is(action: GameAction): action is GameAction & Type.Static<TitleActionSchema<Name, Own, Base>>
    Base: abstract new (
        data: Type.Static<TitleActionSchema<Name, Own, Base>>
    ) => HydratableAction<TitleActionSchema<Name, Own, Base>> &
        Type.Static<TitleActionSchema<Name, Own, Base>>
    define(
        hydrate: (action: Type.Static<TitleActionSchema<Name, Own, Base>>) => HydratedAction
    ): ActionDefinition
}

/**
 * A player's Action of the title: the base copies its stored fields, and subclasses add
 * `apply`. `systemAction` makes the system's.
 */
export function titleAction<const Name extends string, Own extends Type.TProperties>(
    type: Name,
    own: Own
): TitleActionKit<Name, Own, PlayerActionBase> {
    return actionKit(type, own, EighteenXXPlayerAction.properties)
}

export function systemAction<const Name extends string, Own extends Type.TProperties>(
    type: Name,
    own: Own
): TitleActionKit<Name, Own, SystemActionBase> {
    return actionKit(type, own, EighteenXXOperatingAction.properties)
}

function actionKit<
    Name extends string,
    Own extends Type.TProperties,
    Base extends Type.TProperties
>(type: Name, own: Own, base: Base): TitleActionKit<Name, Own, Base> {
    const schema = Type.Object(
        { ...base, type: Type.Literal(type), ...own } as unknown as TitleActionFields<
            Name,
            Own,
            Base
        >,
        { additionalProperties: false }
    )
    type Data = Type.Static<typeof schema>
    const validator = Compile(schema)
    abstract class Kit extends HydratableAction<typeof schema> {
        constructor(data: Data) {
            super(data instanceof Kit ? (data as Kit).dehydrate() : data, validator)
        }
    }
    const is = (action: GameAction): action is GameAction & Data =>
        action instanceof Kit || (action.type === type && validator.Check(action))
    return {
        type,
        schema,
        is,
        Base: Kit as unknown as TitleActionKit<Name, Own, Base>['Base'],
        define: (hydrate) => defineAction(schema, is, hydrate as (action: Data) => HydratedAction)
    }
}
