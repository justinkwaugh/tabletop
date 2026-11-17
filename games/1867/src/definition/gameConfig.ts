import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// The optional rules of the Grand Trunk edition (GTG §14).
const unlimitedSpecialTrainsOption: BooleanConfigOption = {
    id: 'unlimitedSpecialTrains',
    type: ConfigOptionType.Boolean,
    name: 'Unlimited 2+2 and 5+5E',
    description:
        'Recommended. Once the first 8-train is bought, 2+2- and 5+5E-trains are unlimited; otherwise there are two of each.',
    default: true
}

const noPriceFloorOption: BooleanConfigOption = {
    id: 'noPriceFloor',
    type: ConfigOptionType.Boolean,
    name: 'No price floor',
    description:
        'A nationalised company whose price would fall below $35 pays $5 a share less for each space, down to nothing.',
    default: false
}

const longGameOption: BooleanConfigOption = {
    id: 'longGame',
    type: ConfigOptionType.Boolean,
    name: 'Long game',
    description: 'The first 8-train does not end the game: play on until the bank breaks.',
    default: false
}

const proposerOrderOption: BooleanConfigOption = {
    id: 'proposerOrder',
    type: ConfigOptionType.Boolean,
    name: 'Left of auctioneer',
    description:
        'After the auction of a private or minor company, the next turn is the proposer’s left rather than the winner’s.',
    default: false
}

const Schema = Type.Object(
    {
        unlimitedSpecialTrains: Type.Optional(Type.Boolean({ default: true })),
        noPriceFloor: Type.Optional(Type.Boolean({ default: false })),
        longGame: Type.Optional(Type.Boolean({ default: false })),
        proposerOrder: Type.Optional(Type.Boolean({ default: false }))
    },
    { additionalProperties: false }
)

const flag = (config: GameConfig | undefined, id: string) => config?.[id] === true

export const GameConfig1867 = {
    schema: Schema,
    unlimitedSpecialTrains: (config: GameConfig | undefined) =>
        config?.unlimitedSpecialTrains !== false,
    variants: (config: GameConfig | undefined) => ({
        ...(flag(config, 'noPriceFloor') ? { noPriceFloor: true as const } : {}),
        ...(flag(config, 'longGame') ? { longGame: true as const } : {}),
        ...(flag(config, 'proposerOrder') ? { proposerOrder: true as const } : {})
    })
}

export class Configurator1867 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        unlimitedSpecialTrainsOption,
        noPriceFloorOption,
        longGameOption,
        proposerOrderOption
    ]
}
