import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum GameLength {
    Full = 'Full',
    Short = 'Short'
}

export const ROUNDS_BY_LENGTH: Record<GameLength, number> = {
    [GameLength.Full]: 12,
    [GameLength.Short]: 8
}

export type MagnaGreciaGameConfig = Type.Static<typeof MagnaGreciaGameConfig>
export const MagnaGreciaGameConfig = Type.Object({
    gameLength: Type.Optional(Type.Enum(GameLength))
})

export const MagnaGreciaGameConfigOptions: GameConfigOptions = [
    {
        id: 'gameLength',
        type: ConfigOptionType.List,
        name: 'Game length',
        description: 'Play all 12 action cards, or the shorter, less constricted 8-card game',
        default: GameLength.Full,
        options: [
            { name: '12 rounds', value: GameLength.Full },
            { name: '8 rounds', value: GameLength.Short }
        ],
        alwaysShow: true
    }
]

export class MagnaGreciaConfigurator extends BaseConfigurator {
    schema = MagnaGreciaGameConfig
    options = MagnaGreciaGameConfigOptions
}

export function roundCount(config: GameConfig): number {
    const length = Object.values(GameLength).find((value) => value === config.gameLength)
    return ROUNDS_BY_LENGTH[length ?? GameLength.Full]
}
