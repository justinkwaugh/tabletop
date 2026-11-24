import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'

export enum StartingCash {
    Standard = 'Standard',
    Queen = 'Queen',
    Winsome = 'Winsome'
}

export type LwGameConfig = Type.Static<typeof LwGameConfig>
export const LwGameConfig = Type.Object({
    startingCash: Type.Optional(Type.Enum(StartingCash)),
    buyAndShip: Type.Optional(Type.Boolean()),
    // The option's former stored name, still set on games created before the rename.
    lucasOrder: Type.Optional(Type.Boolean())
})

export const LwGameConfigOptions: GameConfigOptions = [
    {
        id: 'startingCash',
        type: ConfigOptionType.List,
        name: 'Starting Cash',
        description: 'How much cash each player starts with.',
        default: StartingCash.Standard,
        options: [
            {
                name: 'Standard',
                value: StartingCash.Standard,
                description: '$10 with three players, $12 with four and $14 with five.'
            },
            {
                name: 'Queen Start Money',
                value: StartingCash.Queen,
                description: '$12 with three or four players and $14 with five.'
            },
            {
                name: 'Winsome Starting Cash',
                value: StartingCash.Winsome,
                description: '$10 with three or four players and $14 with five.'
            }
        ]
    },
    {
        id: 'buyAndShip',
        type: ConfigOptionType.Boolean,
        name: 'Buy and Ship',
        description:
            'Each player buys their production capacity and then ships their first train in the same turn',
        default: false
    }
]
