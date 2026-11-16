import * as Type from 'typebox'
import {
    assertExists,
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

const randomDescription = 'The pieces start spread at random.'
const fixedDescription = "The rulebook's start position."
const tournamentDescription = 'Players take turns placing their pieces on an empty board.'

export const TzaarGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Random: ${randomDescription} Fixed: ${fixedDescription} Tournament: ${tournamentDescription}`,
        default: TzaarVersion.Random,
        options: [
            { name: 'Random start', value: TzaarVersion.Random, description: randomDescription },
            { name: 'Fixed start', value: TzaarVersion.Fixed, description: fixedDescription },
            {
                name: 'Tournament',
                value: TzaarVersion.Tournament,
                description: tournamentDescription
            }
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
    if (config.version === undefined) return TzaarVersion.Random
    const version = Object.values(TzaarVersion).find((known) => known === config.version)
    assertExists(version, `Unknown TZAAR version ${String(config.version)}`)
    return version
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    if (config.whitePlayer === undefined) return WhitePlayer.Random
    const choice = Object.values(WhitePlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of White ${String(config.whitePlayer)}`)
    return choice
}
