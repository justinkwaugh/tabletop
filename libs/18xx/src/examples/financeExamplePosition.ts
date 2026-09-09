import { BaseConfigurator } from '@tabletop/common'
import * as Type from 'typebox'
export const FinanceExamplePosition = Type.Union([
    Type.Literal('trading'),
    Type.Literal('starting'),
    Type.Literal('flotation')
])
export type FinanceExamplePosition = Type.Static<typeof FinanceExamplePosition>

export class FinanceExampleConfigurator extends BaseConfigurator {
    schema = Type.Object(
        { examplePosition: Type.Optional(FinanceExamplePosition) },
        { additionalProperties: false }
    )
    options = []
}
