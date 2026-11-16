import * as Type from 'typebox'
import {
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum YinshVersion {
    Standard = 'Standard',
    Blitz = 'Blitz'
}

export enum WhitePlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export const RINGS_TO_WIN: Record<YinshVersion, number> = {
    [YinshVersion.Standard]: 3,
    [YinshVersion.Blitz]: 1
}

export type YinshGameConfig = Type.Static<typeof YinshGameConfig>
export const YinshGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(YinshVersion)),
    whitePlayer: Type.Optional(Type.Enum(WhitePlayer))
})

const standardDescription = 'Form three rows to win.'
const blitzDescription = 'The first row wins.'

export const YinshGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Standard: ${standardDescription} Blitz: ${blitzDescription}`,
        default: YinshVersion.Standard,
        options: [
            { name: 'Standard', value: YinshVersion.Standard, description: standardDescription },
            { name: 'Blitz', value: YinshVersion.Blitz, description: blitzDescription }
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
            { name: 'Random', value: WhitePlayer.Random, description: 'White is drawn by lot.' },
            {
                name: 'Game creator',
                value: WhitePlayer.Creator,
                description: 'The player who created the game plays White.'
            },
            {
                name: 'Opponent',
                value: WhitePlayer.Opponent,
                description: "The creator's opponent plays White."
            }
        ],
        alwaysShow: true
    }
]

export class YinshConfigurator extends BaseConfigurator {
    schema = YinshGameConfig
    options = YinshGameConfigOptions
}

export function versionFromConfig(config: GameConfig): YinshVersion {
    if (config.version === undefined) return YinshVersion.Standard
    const version = Object.values(YinshVersion).find((known) => known === config.version)
    assertExists(version, `Unknown YINSH version ${String(config.version)}`)
    return version
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    if (config.whitePlayer === undefined) return WhitePlayer.Random
    const choice = Object.values(WhitePlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of White ${String(config.whitePlayer)}`)
    return choice
}
