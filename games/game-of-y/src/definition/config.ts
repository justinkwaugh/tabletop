import * as Type from 'typebox'
import {
    assert,
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum BlackPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type YGameConfig = Type.Static<typeof YGameConfig>
export const YGameConfig = Type.Object({
    swapRule: Type.Optional(Type.Boolean()),
    blackPlayer: Type.Optional(Type.Enum(BlackPlayer))
})

export const YGameConfigOptions: GameConfigOptions = [
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
