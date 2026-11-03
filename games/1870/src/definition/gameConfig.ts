import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// The variants of pp. 24-25 this implementation offers.
const finish400Option: BooleanConfigOption = {
    id: 'finish400',
    type: ConfigOptionType.Boolean,
    name: '$400 finish',
    description:
        'The game ends when a share price reaches $400, after that company finishes operating.',
    default: false
}

const dieselsOption: BooleanConfigOption = {
    id: 'diesels',
    type: ConfigOptionType.Boolean,
    name: '1830 diesels',
    description:
        'No 8-, 10- or 12-trains: diesels run any distance from phase 5 for $1100, or $800 trading in a 4, 5 or 6.',
    default: false
}

const stationWarsOption: BooleanConfigOption = {
    id: 'stationWars',
    type: ConfigOptionType.Boolean,
    name: 'Station marker wars',
    description:
        'Destination stations for Dallas, Fort Worth, New Orleans and St. Louis take a city space when one is open.',
    default: false
}

const Schema = Type.Object(
    {
        finish400: Type.Optional(Type.Boolean({ default: finish400Option.default })),
        diesels: Type.Optional(Type.Boolean({ default: dieselsOption.default })),
        stationWars: Type.Optional(Type.Boolean({ default: stationWarsOption.default }))
    },
    { additionalProperties: false }
)

export const GameConfig1870 = {
    schema: Schema,
    variants: (config: GameConfig | undefined) => ({
        ...(config?.finish400 === true ? { finish400: true as const } : {}),
        ...(config?.diesels === true ? { diesels: true as const } : {}),
        ...(config?.stationWars === true ? { stationWars: true as const } : {})
    })
}

export class Configurator1870 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [finish400Option, dieselsOption, stationWarsOption]
}
