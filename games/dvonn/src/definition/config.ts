import * as Type from 'typebox'
import {
    assertExists,
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

const standardDescription = 'Players place every piece, then stack.'
const randomDescription = 'The board starts filled at random and play begins with stacking.'

export const DvonnGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Standard: ${standardDescription} Random placement: ${randomDescription}`,
        default: DvonnVersion.Standard,
        options: [
            { name: 'Standard', value: DvonnVersion.Standard, description: standardDescription },
            {
                name: 'Random placement',
                value: DvonnVersion.RandomPlacement,
                description: randomDescription
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

export class DvonnConfigurator extends BaseConfigurator {
    schema = DvonnGameConfig
    options = DvonnGameConfigOptions
}

export function versionFromConfig(config: GameConfig): DvonnVersion {
    if (config.version === undefined) return DvonnVersion.Standard
    const version = Object.values(DvonnVersion).find((known) => known === config.version)
    assertExists(version, `Unknown DVONN version ${String(config.version)}`)
    return version
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    if (config.whitePlayer === undefined) return WhitePlayer.Random
    const choice = Object.values(WhitePlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of White ${String(config.whitePlayer)}`)
    return choice
}
