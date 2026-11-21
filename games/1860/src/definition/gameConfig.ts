import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'
import type { Options1860 } from '../titleState.js'

const Schema = Type.Object(
    {
        insolvency: Type.Optional(
            Type.Union([Type.Literal('standard'), Type.Literal('simplified')])
        ),
        noSkippingTowns: Type.Optional(Type.Boolean({ default: false })),
        reenterHexes: Type.Optional(Type.Boolean({ default: false })),
        unoperatedFullValue: Type.Optional(Type.Boolean({ default: false })),
        twoSevenFourTrains: Type.Optional(Type.Boolean({ default: false }))
    },
    { additionalProperties: false }
)

/** The train roster with two 7+4 trains, for players new to the game (Phases). */
export const TwoSevenFourDepotId = '1860:two-7+4'

export const GameConfig1860 = {
    schema: Schema,
    options: (config: GameConfig | undefined): Options1860 => ({
        ...(config?.insolvency === 'simplified' ? { simplifiedInsolvency: true as const } : {}),
        ...(config?.noSkippingTowns === true ? { noSkippingTowns: true as const } : {}),
        ...(config?.reenterHexes === true ? { reenterHexes: true as const } : {}),
        ...(config?.unoperatedFullValue === true ? { unoperatedFullValue: true as const } : {})
    }),
    depotId: (config: GameConfig | undefined): string | undefined =>
        config?.twoSevenFourTrains === true ? TwoSevenFourDepotId : undefined
}

export class Configurator1860 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        {
            id: 'insolvency',
            type: ConfigOptionType.List,
            name: 'Insolvency revenue',
            description: 'What an insolvent company earns with the train it leases.',
            default: 'standard',
            options: [
                {
                    name: 'Standard',
                    value: 'standard',
                    description:
                        '£40, plus £20 for each station or halt the leased train calls at, counting only its large-station allowance.'
                },
                {
                    name: 'Simplified',
                    value: 'simplified',
                    description:
                        'The most the next train could earn: £40, plus £20 for each of its large-station allowance.'
                }
            ]
        },
        {
            id: 'noSkippingTowns',
            type: ConfigOptionType.Boolean,
            name: 'No passing small stations',
            description:
                'The first edition’s rule: a run must stop at every small station it passes; halts may still be passed.',
            default: false
        },
        {
            id: 'reenterHexes',
            type: ConfigOptionType.Boolean,
            name: 'Runs may re-enter hexes',
            description:
                'A run may enter a hex it has left, using none of the track it has already used.',
            default: false
        },
        {
            id: 'unoperatedFullValue',
            type: ConfigOptionType.Boolean,
            name: 'Full price for unoperated shares',
            description:
                'Shares of a company that has not yet operated sell for the full market price, not half.',
            default: false
        },
        {
            id: 'twoSevenFourTrains',
            type: ConfigOptionType.Boolean,
            name: 'Two 7+4 trains',
            description: 'For players new to the game: two 7+4 trains instead of one.',
            default: false
        }
    ]
}
