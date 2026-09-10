import { BaseConfigurator } from '@tabletop/common'
import * as Type from 'typebox'
export const FinanceExamplePosition = Type.Union([
    Type.Literal('trading'),
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
    Type.Literal('private-events')
])
export type FinanceExamplePosition = Type.Static<typeof FinanceExamplePosition>

export class FinanceExampleConfigurator extends BaseConfigurator {
    schema = Type.Object(
        { examplePosition: Type.Optional(FinanceExamplePosition) },
        { additionalProperties: false }
    )
    options = []
}
