import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// §1.1 and §2.2.
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

const Schema = Type.Object(
    {
        fiveCorporations: Type.Optional(Type.Boolean({ default: fiveCorporationsOption.default })),
        delayIft: Type.Optional(Type.Boolean({ default: delayIftOption.default }))
    },
    { additionalProperties: false }
)

export type Variants1849 = { fiveCorporations?: true; delayIft?: true }

export const GameConfig1849 = {
    schema: Schema,
    variants: (config: GameConfig | undefined): Variants1849 => ({
        ...(config?.fiveCorporations === true ? { fiveCorporations: true as const } : {}),
        ...(config?.delayIft === true ? { delayIft: true as const } : {})
    })
}

export class Configurator1849 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [fiveCorporationsOption, delayIftOption]
}
