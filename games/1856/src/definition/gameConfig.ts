import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const alternateDestinationsOption: BooleanConfigOption = {
    id: 'alternateDestinations',
    type: ConfigOptionType.Boolean,
    name: 'Alternate destinations',
    description:
        'Each company has a different destination to reach before its escrow is released, changing the way the game evolves.',
    default: false
}

const eightTrainsOption: BooleanConfigOption = {
    id: 'eightTrains',
    type: ConfigOptionType.Boolean,
    name: '8-trains',
    description:
        'Unlimited $1,000 8-trains, or $650 trading in a 4, 5 or 6, replace the Diesels; the first 8-train starts the last phase.',
    default: false
}

const Schema = Type.Object(
    {
        alternateDestinations: Type.Optional(
            Type.Boolean({ default: alternateDestinationsOption.default })
        ),
        eightTrains: Type.Optional(Type.Boolean({ default: eightTrainsOption.default }))
    },
    { additionalProperties: false }
)

export const GameConfig1856 = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        alternateDestinations: config?.alternateDestinations === true,
        eightTrains: config?.eightTrains === true
    })
}

export class Configurator1856 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [alternateDestinationsOption, eightTrainsOption]
}
