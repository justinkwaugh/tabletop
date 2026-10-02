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

const Schema = Type.Object(
    {
        shortSqueeze: Type.Optional(Type.Boolean({ default: shortSqueezeOption.default })),
        fiveShorts: Type.Optional(Type.Boolean({ default: fiveShortsOption.default }))
    },
    { additionalProperties: false }
)

export const EighteenSeventeenGameConfig = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        shortSqueeze: config?.shortSqueeze === true,
        fiveShorts: config?.fiveShorts === true
    })
}

export class EighteenSeventeenConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [shortSqueezeOption, fiveShortsOption]
}
