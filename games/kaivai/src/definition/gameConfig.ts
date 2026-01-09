import { Type, type Static } from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export enum Ruleset {
    FirstEdition = 'FirstEdition',
    SecondEdition = 'SecondEdition'
}

export type KaivaiGameConfig = Static<typeof KaivaiGameConfig>
export const KaivaiGameConfig = Type.Object({
    ruleset: Type.Enum(Ruleset),
    lucklessFishing: Type.Boolean(),
    lessluckFishing: Type.Optional(Type.Boolean({ default: false }))
})

export const KaivaiGameConfigOptions: GameConfigOptions = [
    {
        id: 'ruleset',
        type: ConfigOptionType.List,
        name: 'Ruleset',
        description: '1st or 2nd edition rules',
        default: Ruleset.FirstEdition,
        options: [
            { name: '1st Edition', value: Ruleset.FirstEdition },
            { name: '2nd Edition', value: Ruleset.SecondEdition }
        ],
        alwaysShow: true
    },
    {
        id: 'lessluckFishing',
        type: ConfigOptionType.Boolean,
        name: 'Less Luck Fishing',
        description:
            'Results are based on the expected value of a fishing roll.  You automatically receive the integer value (rounded down) and the remainder is rolled for',
        default: false
    },
    {
        id: 'lucklessFishing',
        type: ConfigOptionType.Boolean,
        name: 'Luckless Fishing',
        description:
            'Every fishing hut and god present on an island will automatically provide one fish',
        default: false
    }
]
