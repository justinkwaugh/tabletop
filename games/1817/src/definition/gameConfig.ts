import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const shortSqueezeOption: BooleanConfigOption = {
    id: 'shortSqueeze',
    type: ConfigOptionType.Boolean,
    name: 'Short Squeeze',
    description:
        'Companies whose players hold more than 100% move up a second time at the end of a stock round.',
    default: false
}

const fiveShortsOption: BooleanConfigOption = {
    id: 'fiveShorts',
    type: ConfigOptionType.Boolean,
    name: '5 Shorts',
    description: 'At most five shorts on a 10-share company.',
    default: false
}

const modernTrainsOption: BooleanConfigOption = {
    id: 'modernTrains',
    type: ConfigOptionType.Boolean,
    name: 'Modern Trains',
    description: '7- and 8-trains earn $10 and $20 more at each city with their company’s station.',
    default: false
}

const volatilityOption: BooleanConfigOption = {
    id: 'volatility',
    type: ConfigOptionType.Boolean,
    name: 'Volatility',
    description:
        'Thirteen more privates, one of four city-tile privates drawn at random, and a pyramid opening auction.',
    default: false
}

const Schema = Type.Object(
    {
        shortSqueeze: Type.Optional(Type.Boolean({ default: shortSqueezeOption.default })),
        fiveShorts: Type.Optional(Type.Boolean({ default: fiveShortsOption.default })),
        modernTrains: Type.Optional(Type.Boolean({ default: modernTrainsOption.default })),
        volatility: Type.Optional(Type.Boolean({ default: volatilityOption.default }))
    },
    { additionalProperties: false }
)

export const EighteenSeventeenGameConfig = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        shortSqueeze: config?.shortSqueeze === true,
        fiveShorts: config?.fiveShorts === true,
        modernTrains: config?.modernTrains === true,
        volatility: config?.volatility === true
    })
}

export class EighteenSeventeenConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        shortSqueezeOption,
        fiveShortsOption,
        modernTrainsOption,
        volatilityOption
    ]
}
