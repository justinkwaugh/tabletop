import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum DvonnVersion {
    Standard = 'Standard',
    RandomPlacement = 'RandomPlacement'
}

export enum WhitePlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type DvonnGameConfig = Type.Static<typeof DvonnGameConfig>
export const DvonnGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(DvonnVersion)),
    whitePlayer: Type.Optional(Type.Enum(WhitePlayer))
})

export const DvonnGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        description:
            'Standard: players place every piece, then stack. Random placement: the board starts filled at random and play begins with stacking.',
        default: DvonnVersion.Standard,
        options: [
            { name: 'Standard', value: DvonnVersion.Standard },
            { name: 'Random placement', value: DvonnVersion.RandomPlacement }
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

export class DvonnConfigurator extends BaseConfigurator {
    schema = DvonnGameConfig
    options = DvonnGameConfigOptions
}

export function versionFromConfig(config: GameConfig): DvonnVersion {
    return (
        Object.values(DvonnVersion).find((version) => version === config.version) ??
        DvonnVersion.Standard
    )
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    return (
        Object.values(WhitePlayer).find((choice) => choice === config.whitePlayer) ??
        WhitePlayer.Random
    )
}
