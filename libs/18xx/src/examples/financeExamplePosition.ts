import { BaseConfigurator } from '@tabletop/common'
import * as Type from 'typebox'
export const FinanceExamplePosition = Type.Union([
    Type.Literal('trading'),
    Type.Literal('split'),
    Type.Literal('opening'),
    Type.Literal('starting'),
    Type.Literal('flotation'),
    Type.Literal('construction'),
    Type.Literal('stations'),
    Type.Literal('trains'),
    Type.Literal('routes'),
    Type.Literal('operations'),
    Type.Literal('phases'),
    Type.Literal('diesel'),
    Type.Literal('privates'),
    Type.Literal('private-events'),
    Type.Literal('transfers'),
    Type.Literal('powers'),
    Type.Literal('funding'),
    Type.Literal('bankruptcy')
])
export type FinanceExamplePosition = Type.Static<typeof FinanceExamplePosition>

export class FinanceExampleConfigurator extends BaseConfigurator {
    schema = Type.Object(
        { examplePosition: Type.Optional(FinanceExamplePosition) },
        { additionalProperties: false }
    )
    options = []
}
