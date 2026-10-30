import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { BoardShape } from '../model/geometry.js'

export enum WhitePlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type MatrxGameConfig = Type.Static<typeof MatrxGameConfig>
export const MatrxGameConfig = Type.Object({
    board: Type.Optional(Type.Enum(BoardShape)),
    whitePlayer: Type.Optional(Type.Enum(WhitePlayer))
})

export const MatrxGameConfigOptions: GameConfigOptions = [
    {
        id: 'board',
        type: ConfigOptionType.List,
        name: 'Board',
        description:
            'MATRX: the 40-spot MATRX board. GIPF: the 37-spot GIPF board, denser and usually longer.',
        default: BoardShape.Matrx,
        options: [
            { name: 'MATRX board', value: BoardShape.Matrx },
            { name: 'GIPF board', value: BoardShape.Gipf }
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

export class MatrxConfigurator extends BaseConfigurator {
    schema = MatrxGameConfig
    options = MatrxGameConfigOptions
}

export function boardShapeFromConfig(config: GameConfig): BoardShape {
    return Object.values(BoardShape).find((shape) => shape === config.board) ?? BoardShape.Matrx
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    return (
        Object.values(WhitePlayer).find((choice) => choice === config.whitePlayer) ??
        WhitePlayer.Random
    )
}
