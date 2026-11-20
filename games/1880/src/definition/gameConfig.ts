import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const randomInvestorsOption: BooleanConfigOption = {
    id: 'randomInvestors',
    type: ConfigOptionType.Boolean,
    name: 'Random investors',
    description:
        'A number of foreign investors equal to the player count are drawn at random to be available; the rest are out of the game.',
    default: false
}

const Schema = Type.Object(
    {
        randomInvestors: Type.Optional(Type.Boolean({ default: randomInvestorsOption.default }))
    },
    { additionalProperties: false }
)

export const GameConfig1880 = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        randomInvestors: config?.randomInvestors === true
    })
}

export class Configurator1880 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [randomInvestorsOption]
}
