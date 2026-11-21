import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const seventeenTrainsOption: BooleanConfigOption = {
    id: 'seventeenTrains',
    type: ConfigOptionType.Boolean,
    name: '1817 trains',
    description:
        'Use 1817’s train roster and exports: no 3+ or 4+ trains, and the next train is exported after every operating round.',
    default: false
}

const highStartPricesOption: BooleanConfigOption = {
    id: 'highStartPrices',
    type: ConfigOptionType.Boolean,
    name: '$300 start price after phase 5',
    description:
        'From the first 5-train, companies may start at up to $300; a company with less than half its shares in players’ hands at the end of its first stock round is liquidated.',
    default: false
}

const noPresidentLimitOption: BooleanConfigOption = {
    id: 'noPresidentLimit',
    type: ConfigOptionType.Boolean,
    name: 'No 60% president limit',
    description:
        'In stock rounds a president may hold more than 60% of their company; while no other share is for sale, other players may then buy from the president at 10% above the price.',
    default: false
}

const Schema = Type.Object(
    {
        seventeenTrains: Type.Optional(Type.Boolean({ default: seventeenTrainsOption.default })),
        highStartPrices: Type.Optional(Type.Boolean({ default: highStartPricesOption.default })),
        noPresidentLimit: Type.Optional(Type.Boolean({ default: noPresidentLimitOption.default }))
    },
    { additionalProperties: false }
)

export const EighteenUSAGameConfig = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        seventeenTrains: config?.seventeenTrains === true,
        highStartPrices: config?.highStartPrices === true,
        noPresidentLimit: config?.noPresidentLimit === true
    })
}

export class EighteenUSAConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        seventeenTrainsOption,
        highStartPricesOption,
        noPresidentLimitOption
    ]
}
