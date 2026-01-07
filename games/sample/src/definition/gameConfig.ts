import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type SampleGameConfig = Static<typeof SampleGameConfig>
export const SampleGameConfig = Type.Object({
    bigTotalsAllowed: Type.Boolean()
})

export const SampleGameConfigValidator = Compile(SampleGameConfig)

export const SampleGameConfigOptions: GameConfigOptions = [
    {
        id: 'bigTotalsAllowed',
        type: ConfigOptionType.Boolean,
        name: 'Big Totals Allowed',
        description: 'Allows the total to exceed the normal limit... can be 200 or more!',
        default: false
    }
]
