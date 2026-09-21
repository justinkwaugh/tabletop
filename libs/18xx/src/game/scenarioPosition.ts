import { BaseConfigurator } from '@tabletop/common'
import * as Type from 'typebox'
export const ScenarioPosition = Type.Union([
    Type.Literal('trading'),
    Type.Literal('ending'),
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
    Type.Literal('funding-chain'),
    Type.Literal('bankruptcy')
])
export type ScenarioPosition = Type.Static<typeof ScenarioPosition>

export class ScenarioConfigurator extends BaseConfigurator {
    schema = Type.Object(
        { examplePosition: Type.Optional(ScenarioPosition) },
        { additionalProperties: false }
    )
    options = []
}
