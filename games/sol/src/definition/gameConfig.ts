import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type SolGameConfig = Static<typeof SolGameConfig>
export const SolGameConfig = Type.Object({
    lowConflict: Type.Boolean()
})

export const SolGameConfigValidator = Compile(SolGameConfig)

export const SolGameConfigOptions: GameConfigOptions = [
    {
        id: 'lowConflict',
        type: ConfigOptionType.Boolean,
        name: 'Low Conflict',
        description: 'Removes the direct conflict cards',
        default: false
    }
]
