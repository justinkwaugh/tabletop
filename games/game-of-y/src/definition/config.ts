import * as Type from 'typebox'
import {
    assert,
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

import { BoardShape } from '../model/boardShape.js'

export enum BlackPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type YGameConfig = Type.Static<typeof YGameConfig>
export const YGameConfig = Type.Object({
    board: Type.Optional(Type.Enum(BoardShape)),
    swapRule: Type.Optional(Type.Boolean()),
    blackPlayer: Type.Optional(Type.Enum(BlackPlayer))
})

export const YGameConfigOptions: GameConfigOptions = [
    {
        id: 'board',
        type: ConfigOptionType.List,
        name: 'Board',
        description:
            'The board to play on. Every board is a triangle; join all three sides to win.',
        default: BoardShape.Kadon,
        options: [
            {
                name: 'Kadon board, 93 points',
                value: BoardShape.Kadon,
                description:
                    "Kadon's published board: 93 points on curved sides, 9 to a side. Most points touch six others; three in the middle touch five."
            },
            {
                name: 'Hex board, 9 a side',
                value: BoardShape.Hex9,
                description: 'A triangle of 45 hexagons, 9 to a side: a short game.'
            },
            {
                name: 'Hex board, 13 a side',
                value: BoardShape.Hex13,
                description:
                    "A triangle of 91 hexagons, 13 to a side: about as long as Kadon's board."
            },
            {
                name: 'Hex board, 19 a side',
                value: BoardShape.Hex19,
                description: 'A triangle of 190 hexagons, 19 to a side: a long game.'
            }
        ],
        alwaysShow: true
    },
    {
        id: 'swapRule',
        type: ConfigOptionType.Boolean,
        name: 'Swap rule',
        description:
            "After Black's first stone, White may take it over: the players trade colours and the new White plays next.",
        default: true
    },
    {
        id: 'blackPlayer',
        type: ConfigOptionType.List,
        name: 'Black',
        description: 'Who plays Black and goes first.',
        default: BlackPlayer.Random,
        options: [
            { name: 'Random', value: BlackPlayer.Random, description: 'Black is drawn by lot.' },
            {
                name: 'Game creator',
                value: BlackPlayer.Creator,
                description: 'The player who created the game plays Black.'
            },
            {
                name: 'Opponent',
                value: BlackPlayer.Opponent,
                description: "The creator's opponent plays Black."
            }
        ],
        alwaysShow: true
    }
]

export class YConfigurator extends BaseConfigurator {
    schema = YGameConfig
    options = YGameConfigOptions
}

export function boardShapeFromConfig(config: GameConfig): BoardShape {
    if (config.board === undefined) return BoardShape.Kadon
    const shape = Object.values(BoardShape).find((known) => known === config.board)
    assertExists(shape, `Unknown board ${String(config.board)}`)
    return shape
}

export function swapRuleFromConfig(config: GameConfig): boolean {
    if (config.swapRule === undefined) return true
    assert(
        typeof config.swapRule === 'boolean',
        `Unknown swap rule setting ${String(config.swapRule)}`
    )
    return config.swapRule
}

export function blackPlayerFromConfig(config: GameConfig): BlackPlayer {
    if (config.blackPlayer === undefined) return BlackPlayer.Random
    const choice = Object.values(BlackPlayer).find((known) => known === config.blackPlayer)
    assertExists(choice, `Unknown choice of Black ${String(config.blackPlayer)}`)
    return choice
}
