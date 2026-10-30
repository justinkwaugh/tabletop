import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum TzaarVersion {
    Random = 'Random',
    Fixed = 'Fixed',
    Tournament = 'Tournament'
}

export enum WhitePlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type TzaarGameConfig = Type.Static<typeof TzaarGameConfig>
export const TzaarGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(TzaarVersion)),
    whitePlayer: Type.Optional(Type.Enum(WhitePlayer))
})

export const TzaarGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        description:
            "Random: the pieces start spread at random. Fixed: the rulebook's start position. Tournament: players take turns placing their pieces on an empty board.",
        default: TzaarVersion.Random,
        options: [
            { name: 'Random start', value: TzaarVersion.Random },
            { name: 'Fixed start', value: TzaarVersion.Fixed },
            { name: 'Tournament', value: TzaarVersion.Tournament }
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

export class TzaarConfigurator extends BaseConfigurator {
    schema = TzaarGameConfig
    options = TzaarGameConfigOptions
}

export function versionFromConfig(config: GameConfig): TzaarVersion {
    return (
        Object.values(TzaarVersion).find((version) => version === config.version) ??
        TzaarVersion.Random
    )
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    return (
        Object.values(WhitePlayer).find((choice) => choice === config.whitePlayer) ??
        WhitePlayer.Random
    )
}
