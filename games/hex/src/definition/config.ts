import * as Type from 'typebox'
import {
    assert,
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

import { BoardSize } from '../model/boardSize.js'

export enum RedPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type HexGameConfig = Type.Static<typeof HexGameConfig>
export const HexGameConfig = Type.Object({
    size: Type.Optional(Type.Enum(BoardSize)),
    swapRule: Type.Optional(Type.Boolean()),
    redPlayer: Type.Optional(Type.Enum(RedPlayer))
})

export const HexGameConfigOptions: GameConfigOptions = [
    {
        id: 'size',
        type: ConfigOptionType.List,
        name: 'Board',
        description:
            'How many cells to a side. Bigger boards make longer, deeper games; 11 is the classic size.',
        default: BoardSize.Eleven,
        options: [
            {
                name: '9 × 9',
                value: BoardSize.Nine,
                description: '81 cells: a short game, good for learning.'
            },
            {
                name: '11 × 11',
                value: BoardSize.Eleven,
                description:
                    "121 cells: Piet Hein's classic board, played at the Computer Olympiad."
            },
            {
                name: '13 × 13',
                value: BoardSize.Thirteen,
                description: '169 cells: the size most played online.'
            },
            {
                name: '14 × 14',
                value: BoardSize.Fourteen,
                description: "196 cells: John Nash's suggested size."
            },
            {
                name: '19 × 19',
                value: BoardSize.Nineteen,
                description: '361 cells, as many as a go board: a long game.'
            }
        ],
        alwaysShow: true
    },
    {
        id: 'swapRule',
        type: ConfigOptionType.Boolean,
        name: 'Swap rule',
        description:
            "After Red's first stone, Blue may take it over: the players trade colours and the new Blue plays next.",
        default: true
    },
    {
        id: 'redPlayer',
        type: ConfigOptionType.List,
        name: 'Red',
        description: 'Who plays Red and goes first.',
        default: RedPlayer.Random,
        options: [
            { name: 'Random', value: RedPlayer.Random, description: 'Red is drawn by lot.' },
            {
                name: 'Game creator',
                value: RedPlayer.Creator,
                description: 'The player who created the game plays Red.'
            },
            {
                name: 'Opponent',
                value: RedPlayer.Opponent,
                description: "The creator's opponent plays Red."
            }
        ],
        alwaysShow: true
    }
]

export class HexConfigurator extends BaseConfigurator {
    schema = HexGameConfig
    options = HexGameConfigOptions
}

export function boardSizeFromConfig(config: GameConfig): BoardSize {
    if (config.size === undefined) return BoardSize.Eleven
    const size = Object.values(BoardSize).find((known) => known === config.size)
    assertExists(size, `Unknown board size ${String(config.size)}`)
    return size
}

export function swapRuleFromConfig(config: GameConfig): boolean {
    if (config.swapRule === undefined) return true
    assert(
        typeof config.swapRule === 'boolean',
        `Unknown swap rule setting ${String(config.swapRule)}`
    )
    return config.swapRule
}

export function redPlayerFromConfig(config: GameConfig): RedPlayer {
    if (config.redPlayer === undefined) return RedPlayer.Random
    const choice = Object.values(RedPlayer).find((known) => known === config.redPlayer)
    assertExists(choice, `Unknown choice of Red ${String(config.redPlayer)}`)
    return choice
}
