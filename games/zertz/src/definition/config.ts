import * as Type from 'typebox'
import {
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { MarbleColor, type MarbleCounts } from '../model/marbles.js'

export enum ZertzSetup {
    Standard = 'Standard',
    Blitz = 'Blitz',
    Tournament = 'Tournament'
}

export enum FirstPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export enum BoardLayout {
    Rings37 = 'Rings37',
    Rings48 = 'Rings48'
}

export type WinCondition = {
    eachColor: number
    singleColor: MarbleCounts
}

export type SetupRules = {
    board: BoardLayout
    pool: MarbleCounts
    win: WinCondition
}

const STANDARD_POOL: MarbleCounts = {
    [MarbleColor.White]: 6,
    [MarbleColor.Grey]: 8,
    [MarbleColor.Black]: 10
}

const STANDARD_WIN: WinCondition = {
    eachColor: 3,
    singleColor: { [MarbleColor.White]: 4, [MarbleColor.Grey]: 5, [MarbleColor.Black]: 6 }
}

export const SETUP_RULES: Record<ZertzSetup, SetupRules> = {
    [ZertzSetup.Standard]: {
        board: BoardLayout.Rings37,
        pool: STANDARD_POOL,
        win: STANDARD_WIN
    },
    [ZertzSetup.Blitz]: {
        board: BoardLayout.Rings37,
        pool: { [MarbleColor.White]: 5, [MarbleColor.Grey]: 7, [MarbleColor.Black]: 9 },
        win: {
            eachColor: 2,
            singleColor: { [MarbleColor.White]: 3, [MarbleColor.Grey]: 4, [MarbleColor.Black]: 5 }
        }
    },
    [ZertzSetup.Tournament]: {
        board: BoardLayout.Rings48,
        pool: STANDARD_POOL,
        win: STANDARD_WIN
    }
}

export type ZertzGameConfig = Type.Static<typeof ZertzGameConfig>
export const ZertzGameConfig = Type.Object({
    setup: Type.Optional(Type.Enum(ZertzSetup)),
    autoJump: Type.Optional(Type.Boolean()),
    firstPlayer: Type.Optional(Type.Enum(FirstPlayer))
})

const standardDescription =
    '37 rings and 6 white, 8 grey and 10 black marbles. Win with 4 white, 5 grey, 6 black or 3 of each.'
const blitzDescription =
    '37 rings and 5 white, 7 grey and 9 black marbles. Win with 3 white, 4 grey, 5 black or 2 of each.'
const tournamentDescription = '48 rings, with the standard marbles and win.'

export const ZertzGameConfigOptions: GameConfigOptions = [
    {
        id: 'setup',
        type: ConfigOptionType.List,
        name: 'Setup',
        // Older site forms show only this, so it describes every setup.
        description: `Standard: ${standardDescription} Blitz: ${blitzDescription} Tournament: ${tournamentDescription}`,
        default: ZertzSetup.Standard,
        options: [
            {
                name: 'Standard (37 rings)',
                value: ZertzSetup.Standard,
                description: standardDescription
            },
            { name: 'Blitz (37 rings)', value: ZertzSetup.Blitz, description: blitzDescription },
            {
                name: 'Tournament (48 rings)',
                value: ZertzSetup.Tournament,
                description: tournamentDescription
            }
        ],
        alwaysShow: true
    },
    {
        id: 'firstPlayer',
        type: ConfigOptionType.List,
        name: 'First player',
        description: 'Who makes the first move.',
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
    },
    {
        id: 'autoJump',
        type: ConfigOptionType.Boolean,
        name: 'Auto-jump for both players',
        description:
            // Names the board chip by its glyph, so a player can find it in the game.
            'Jumps with only one choice are made at once for both players. Otherwise each player can turn it on in the game with the 🤖↷● chip beside A1.',
        default: false
    }
]

export class ZertzConfigurator extends BaseConfigurator {
    schema = ZertzGameConfig
    options = ZertzGameConfigOptions
}

export function setupFromConfig(config: GameConfig): ZertzSetup {
    return Object.values(ZertzSetup).find((setup) => setup === config.setup) ?? ZertzSetup.Standard
}

export function autoJumpFromConfig(config: GameConfig): boolean {
    return config.autoJump === true
}

export function firstPlayerFromConfig(config: GameConfig): FirstPlayer {
    if (config.firstPlayer === undefined) return FirstPlayer.Random
    const choice = Object.values(FirstPlayer).find((known) => known === config.firstPlayer)
    assertExists(choice, `Unknown choice of first player ${String(config.firstPlayer)}`)
    return choice
}
