import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { Variant } from '../model/gameState.js'

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

export const PunctGameConfigOptions: GameConfigOptions = [
    {
        id: 'variant',
        type: ConfigOptionType.List,
        name: 'Version',
        description:
            'Standard: new pieces never enter the central hexagon, and when a player places their last piece the most central spaces wins. Basic: only White’s first piece stays out of the centre, and the last piece without a connection ends the game undecided.',
        default: Variant.Standard,
        options: [
            { name: 'Standard', value: Variant.Standard },
            { name: 'Basic', value: Variant.Basic }
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
    return Object.values(Variant).find((variant) => variant === config.variant) ?? Variant.Standard
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    return (
        Object.values(WhitePlayer).find((choice) => choice === config.whitePlayer) ??
        WhitePlayer.Random
    )
}
