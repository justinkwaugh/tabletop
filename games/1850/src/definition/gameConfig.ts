import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// §16, less Historical Order Start.
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
        'No 8-, 10- or 12-trains: diesels run any distance from the first 6-train for $1100, or $800 trading in a 4, 5 or 6.',
    default: false
}

const reducedTokensOption: BooleanConfigOption = {
    id: 'reducedTokens',
    type: ConfigOptionType.Boolean,
    name: 'Reduced tokens',
    description:
        'The CB&Q and the Rock Island each have one fewer $100 token, for a more open map.',
    default: false
}

const Schema = Type.Object(
    {
        finish400: Type.Optional(Type.Boolean({ default: finish400Option.default })),
        diesels: Type.Optional(Type.Boolean({ default: dieselsOption.default })),
        reducedTokens: Type.Optional(Type.Boolean({ default: reducedTokensOption.default }))
    },
    { additionalProperties: false }
)

export const GameConfig1850 = {
    schema: Schema,
    variants: (config: GameConfig | undefined) => ({
        ...(config?.finish400 === true ? { finish400: true as const } : {}),
        ...(config?.diesels === true ? { diesels: true as const } : {}),
        ...(config?.reducedTokens === true ? { reducedTokens: true as const } : {})
    })
}

export class Configurator1850 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [finish400Option, dieselsOption, reducedTokensOption]
}
