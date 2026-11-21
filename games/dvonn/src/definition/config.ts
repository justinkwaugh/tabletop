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
    RandomPlacement = 'RandomPlacement',
    ISetYouChoose = 'ISetYouChoose'
}

export enum FirstPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type DvonnGameConfig = Type.Static<typeof DvonnGameConfig>
export const DvonnGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(DvonnVersion)),
    // Stored games keep the key from before the first player could end up with Black.
    whitePlayer: Type.Optional(Type.Enum(FirstPlayer))
})

const standardDescription = 'Players place every piece, then stack.'
const randomDescription = 'The board starts filled at random and play begins with stacking.'
const iSetYouChooseDescription =
    'The first player places every piece, then the other picks a colour. White moves first.'

export const DvonnGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Standard: ${standardDescription} Random placement: ${randomDescription} I set, you choose: ${iSetYouChooseDescription}`,
        default: DvonnVersion.Standard,
        options: [
            { name: 'Standard', value: DvonnVersion.Standard, description: standardDescription },
            {
                name: 'Random placement',
                value: DvonnVersion.RandomPlacement,
                description: randomDescription
            },
            {
                name: 'I set, you choose',
                value: DvonnVersion.ISetYouChoose,
                description: iSetYouChooseDescription
            }
        ],
        alwaysShow: true
    },
    {
        id: 'whitePlayer',
        type: ConfigOptionType.List,
        name: 'First player',
        description: 'Who plays White and goes first, or in I set, you choose sets the board.',
        default: FirstPlayer.Random,
        options: [
            {
                name: 'Random',
                value: FirstPlayer.Random,
                description: 'The first player is drawn by lot.'
            },
            {
                name: 'Game creator',
                value: FirstPlayer.Creator,
                description: 'The player who created the game goes first.'
            },
            {
                name: 'Opponent',
                value: FirstPlayer.Opponent,
                description: "The creator's opponent goes first."
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

export function firstPlayerFromConfig(config: GameConfig): FirstPlayer {
    if (config.whitePlayer === undefined) return FirstPlayer.Random
    const choice = Object.values(FirstPlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of first player ${String(config.whitePlayer)}`)
    return choice
}
