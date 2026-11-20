import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const beginnerPrivatesOption: BooleanConfigOption = {
    id: 'beginnerPrivates',
    type: ConfigOptionType.Boolean,
    name: 'Friendly $250 privates',
    description:
        'At least one of the Grand Trunk, Norfolk & Western and Ontario, Simcoe & Huron privates stays in the game, the rulebook’s advice for players new to 1828.',
    default: false
}

const Schema = Type.Object(
    {
        beginnerPrivates: Type.Optional(Type.Boolean({ default: beginnerPrivatesOption.default }))
    },
    { additionalProperties: false }
)

export const GameConfig1828 = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        beginnerPrivates: config?.beginnerPrivates === true
    })
}

export class Configurator1828 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [beginnerPrivatesOption]
}
