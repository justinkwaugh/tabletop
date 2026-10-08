import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// The variants of §17 this implementation offers.
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
        'No 8- or 10-trains; 12-trains become diesels after the first 6-train, taking $300 trade-ins, and 5-trains are permanent.',
    default: false
}

const noMergersOption: BooleanConfigOption = {
    id: 'noMergers',
    type: ConfigOptionType.Boolean,
    name: 'No mergers',
    description: 'Companies never form Systems or take each other over.',
    default: false
}

const Schema = Type.Object(
    {
        finish400: Type.Optional(Type.Boolean({ default: finish400Option.default })),
        diesels: Type.Optional(Type.Boolean({ default: dieselsOption.default })),
        noMergers: Type.Optional(Type.Boolean({ default: noMergersOption.default }))
    },
    { additionalProperties: false }
)

export const EighteenThirtyTwoGameConfig = {
    schema: Schema,
    /** The variants chosen, as the title state records them. */
    variants: (config: GameConfig | undefined) => ({
        ...(config?.finish400 === true ? { finish400: true as const } : {}),
        ...(config?.diesels === true ? { diesels: true as const } : {}),
        ...(config?.noMergers === true ? { noMergers: true as const } : {})
    })
}

export class EighteenThirtyTwoConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [finish400Option, dieselsOption, noMergersOption]
}
