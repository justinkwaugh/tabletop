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
    Tournament = 'Tournament',
    ISetYouChoose = 'ISetYouChoose'
}

export enum FirstPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type TzaarGameConfig = Type.Static<typeof TzaarGameConfig>
export const TzaarGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(TzaarVersion)),
    // Stored games keep the key from before the first player could end up with Black.
    whitePlayer: Type.Optional(Type.Enum(FirstPlayer))
})

const randomDescription = 'The pieces start spread at random.'
const fixedDescription = "The rulebook's start position."
const tournamentDescription = 'Players take turns placing their pieces on an empty board.'
const iSetYouChooseDescription =
    'The first player places every piece, then the other picks a colour. White moves first.'

export const TzaarGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Random: ${randomDescription} Fixed: ${fixedDescription} Tournament: ${tournamentDescription} I set, you choose: ${iSetYouChooseDescription}`,
        default: TzaarVersion.Random,
        options: [
            { name: 'Random start', value: TzaarVersion.Random, description: randomDescription },
            { name: 'Fixed start', value: TzaarVersion.Fixed, description: fixedDescription },
            {
                name: 'Tournament',
                value: TzaarVersion.Tournament,
                description: tournamentDescription
            },
            {
                name: 'I set, you choose',
                value: TzaarVersion.ISetYouChoose,
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
            { name: 'Random', value: FirstPlayer.Random },
            { name: 'Game creator', value: FirstPlayer.Creator },
            { name: 'Opponent', value: FirstPlayer.Opponent }
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

// The versions whose pieces are placed one at a time on an empty board.
export function placesPieces(version: TzaarVersion): boolean {
    return version === TzaarVersion.Tournament || version === TzaarVersion.ISetYouChoose
}

export function firstPlayerFromConfig(config: GameConfig): FirstPlayer {
    if (config.whitePlayer === undefined) return FirstPlayer.Random
    const choice = Object.values(FirstPlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of first player ${String(config.whitePlayer)}`)
    return choice
}
