import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export enum Ruleset {
    FirstEdition = 'FirstEdition',
    SecondEdition = 'SecondEdition'
}

export type KaivaiGameConfig = Static<typeof KaivaiGameConfig>
export const KaivaiGameConfig = Type.Object({
    ruleset: Type.Enum(Ruleset),
    lucklessFishing: Type.Boolean()
})

export const KaivaiGameConfigValidator = TypeCompiler.Compile(KaivaiGameConfig)

export const KaivaiGameConfigOptions: GameConfigOptions = [
    {
        id: 'ruleset',
        type: ConfigOptionType.List,
        name: 'Ruleset',
        description: '1st or 2nd edition rules',
        default: Ruleset.SecondEdition,
        options: [
            { name: '1st Edition', value: Ruleset.FirstEdition },
            { name: '2nd Edition', value: Ruleset.SecondEdition }
        ]
    },
    {
        id: 'lucklessFishing',
        type: ConfigOptionType.Boolean,
        name: 'Luckless Fishing',
        description: 'Whether or not to roll dice when fishing',
        default: false
    }
]
