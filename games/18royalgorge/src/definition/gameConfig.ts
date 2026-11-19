import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'
import type { VariantsRoyalGorge } from '../state.js'

const shorterGameOption: BooleanConfigOption = {
    id: 'shorterGame',
    type: ConfigOptionType.Boolean,
    name: 'Shorter Game',
    description:
        'When the end is triggered, finish the current set of operating rounds and score; an end triggered by an exported train still plays its stock round and set.',
    default: false
}

const noPrivatesOption: BooleanConfigOption = {
    id: 'noPrivates',
    type: ConfigOptionType.Boolean,
    name: 'No Privates',
    description: 'For new players: no private assets are dealt, and there is no auction.',
    default: false
}

const alternatePricesOption: BooleanConfigOption = {
    id: 'alternatePrices',
    type: ConfigOptionType.Boolean,
    name: 'Alternate Gold and Steel Prices',
    description:
        'Steel starts at the minimum bid of a yellow card drawn from Y1–Y3, and gold at that of a green card drawn from G1–G3, instead of $45.',
    default: false
}

const Schema = Type.Object(
    {
        shorterGame: Type.Optional(Type.Boolean({ default: false })),
        noPrivates: Type.Optional(Type.Boolean({ default: false })),
        alternatePrices: Type.Optional(Type.Boolean({ default: false }))
    },
    { additionalProperties: false }
)

export const GameConfigRoyalGorge = {
    schema: Schema,
    variants: (config: GameConfig | undefined): VariantsRoyalGorge => ({
        ...(config?.shorterGame === true ? { shorterGame: true as const } : {}),
        ...(config?.noPrivates === true ? { noPrivates: true as const } : {}),
        ...(config?.alternatePrices === true ? { alternatePrices: true as const } : {})
    })
}

export class ConfiguratorRoyalGorge extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [shorterGameOption, noPrivatesOption, alternatePricesOption]
}
