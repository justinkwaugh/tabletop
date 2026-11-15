import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'

export enum MessageRule {
    EveryYear = 'EveryYear',
    FromSecondYear = 'FromSecondYear',
    Never = 'Never'
}

export const GAME_LENGTHS = ['4', '5', '6', '7', '8'] as const
export const DEFAULT_GAME_LENGTH = '6'

export type DickeKartoffelnGameConfig = Type.Static<typeof DickeKartoffelnGameConfig>
export const DickeKartoffelnGameConfig = Type.Object({
    years: Type.Optional(
        Type.Union([
            Type.Literal('4'),
            Type.Literal('5'),
            Type.Literal('6'),
            Type.Literal('7'),
            Type.Literal('8')
        ])
    ),
    messages: Type.Optional(Type.Enum(MessageRule)),
    strictEcology: Type.Optional(Type.Boolean())
})

export const DickeKartoffelnGameConfigOptions: GameConfigOptions = [
    {
        id: 'years',
        type: ConfigOptionType.List,
        name: 'Years',
        description:
            'How many farming years to play. The rules recommend at least four; the game shows its real charm over six.',
        default: DEFAULT_GAME_LENGTH,
        options: GAME_LENGTHS.map((years) => ({ name: `${years} years`, value: years })),
        alwaysShow: true
    },
    {
        id: 'messages',
        type: ConfigOptionType.List,
        name: 'Messages',
        description: 'Whether a news message is rolled for each year.',
        default: MessageRule.EveryYear,
        options: [
            {
                name: 'Every year',
                value: MessageRule.EveryYear,
                description: 'A news message is rolled every year.'
            },
            {
                name: 'From the second year',
                value: MessageRule.FromSecondYear,
                description:
                    'The first year passes without news, as the rules suggest for a first game.'
            },
            {
                name: 'Never',
                value: MessageRule.Never,
                description: 'No news and no poison: prices move only with the harvests.'
            }
        ],
        alwaysShow: true
    },
    {
        id: 'strictEcology',
        type: ConfigOptionType.Boolean,
        name: 'Strict ecology',
        description:
            "Subtract the land's starting ecological value of 55 from each ecology result; a farmer left negative earns no ecology points.",
        default: false
    }
]
