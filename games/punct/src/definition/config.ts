import * as Type from 'typebox'
import {
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum Variant {
    Standard = 'Standard',
    Basic = 'Basic'
}

export enum WhitePlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type PunctGameConfig = Type.Static<typeof PunctGameConfig>
export const PunctGameConfig = Type.Object({
    variant: Type.Optional(Type.Enum(Variant)),
    whitePlayer: Type.Optional(Type.Enum(WhitePlayer))
})

const standardDescription =
    'New pieces never enter the central hexagon, and when a player places their last piece the most central spaces wins.'
const basicDescription =
    'Only White’s first piece stays out of the centre, and the last piece without a connection ends the game undecided.'

export const PunctGameConfigOptions: GameConfigOptions = [
    {
        id: 'variant',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Standard: ${standardDescription} Basic: ${basicDescription}`,
        default: Variant.Standard,
        options: [
            { name: 'Standard', value: Variant.Standard, description: standardDescription },
            { name: 'Basic', value: Variant.Basic, description: basicDescription }
        ],
        alwaysShow: true
    },
    {
        id: 'whitePlayer',
        type: ConfigOptionType.List,
        name: 'White',
        description: 'Who plays White and goes first.',
        default: WhitePlayer.Random,
        options: [
            { name: 'Random', value: WhitePlayer.Random },
            { name: 'Game creator', value: WhitePlayer.Creator },
            { name: 'Opponent', value: WhitePlayer.Opponent }
        ],
        alwaysShow: true
    }
]

export class PunctConfigurator extends BaseConfigurator {
    schema = PunctGameConfig
    options = PunctGameConfigOptions
}

export function variantFromConfig(config: GameConfig): Variant {
    if (config.variant === undefined) return Variant.Standard
    const variant = Object.values(Variant).find((known) => known === config.variant)
    assertExists(variant, `Unknown PÜNCT version ${String(config.variant)}`)
    return variant
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    if (config.whitePlayer === undefined) return WhitePlayer.Random
    const choice = Object.values(WhitePlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of White ${String(config.whitePlayer)}`)
    return choice
}
