import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// §1.1, §2.2 and the variants of §14.
const fiveCorporationsOption: BooleanConfigOption = {
    id: 'fiveCorporations',
    type: ConfigOptionType.Boolean,
    name: 'Five corporations with four players',
    description:
        'Four players use five corporations instead of six, with one 6H, 8H and 16H fewer and a certificate limit of 9. Three players always use five and five players six.',
    default: false
}

const delayIftOption: BooleanConfigOption = {
    id: 'delayIft',
    type: ConfigOptionType.Boolean,
    name: 'Delay the IFT',
    description:
        'The Trinacria (IFT) is not among the first three corporations to become available, as recommended for new players.',
    default: false
}

const bondsOption: BooleanConfigOption = {
    id: 'bonds',
    type: ConfigOptionType.Boolean,
    name: 'Bonds',
    description:
        'From phase 8 each corporation may issue a single L. 500 bond at the end of its turn, paying L. 50 interest each turn until it repays it.',
    default: false
}

const buyStationTokensOption: BooleanConfigOption = {
    id: 'buyStationTokens',
    type: ConfigOptionType.Boolean,
    name: 'Buy station tokens',
    description:
        'From phase 6 a corporation may buy another corporation’s station token in a city it reaches, if that corporation’s president agrees.',
    default: false
}

const electricDreamsOption: BooleanConfigOption = {
    id: 'electricDreams',
    type: ConfigOptionType.Boolean,
    name: 'Electric Dreams',
    description:
        'E tokens and E trains that run any distance off narrow gauge, doubling the four great cities. Plays with Bonds and Buy station tokens.',
    default: false
}

const Schema = Type.Object(
    {
        fiveCorporations: Type.Optional(Type.Boolean({ default: fiveCorporationsOption.default })),
        delayIft: Type.Optional(Type.Boolean({ default: delayIftOption.default })),
        bonds: Type.Optional(Type.Boolean({ default: bondsOption.default })),
        buyStationTokens: Type.Optional(Type.Boolean({ default: buyStationTokensOption.default })),
        electricDreams: Type.Optional(Type.Boolean({ default: electricDreamsOption.default }))
    },
    { additionalProperties: false }
)

export type Variants1849 = {
    fiveCorporations?: true
    delayIft?: true
    bonds?: true
    buyStationTokens?: true
    electricDreams?: true
}

export const GameConfig1849 = {
    schema: Schema,
    variants: (config: GameConfig | undefined): Variants1849 => {
        // Electric Dreams is played only with the other variants (§14.3).
        const electricDreams = config?.electricDreams === true
        return {
            ...(config?.fiveCorporations === true ? { fiveCorporations: true as const } : {}),
            ...(config?.delayIft === true ? { delayIft: true as const } : {}),
            ...(electricDreams || config?.bonds === true ? { bonds: true as const } : {}),
            ...(electricDreams || config?.buyStationTokens === true
                ? { buyStationTokens: true as const }
                : {}),
            ...(electricDreams ? { electricDreams: true as const } : {})
        }
    }
}

export class Configurator1849 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        fiveCorporationsOption,
        delayIftOption,
        bondsOption,
        buyStationTokensOption,
        electricDreamsOption
    ]
}
