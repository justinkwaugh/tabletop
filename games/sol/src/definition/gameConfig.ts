import { Type, type Static } from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type SolGameConfig = Static<typeof SolGameConfig>
export const SolGameConfig = Type.Object({
    lowConflict: Type.Boolean(),
    noBlue: Type.Boolean(),
    noGreen: Type.Boolean(),
    noYellow: Type.Boolean()
})

export const SolGameConfigOptions: GameConfigOptions = [
    {
        id: 'noBlue',
        type: ConfigOptionType.Boolean,
        name: 'No Blue Effects',
        description: 'Removes the blue effects',
        default: false
    },
    {
        id: 'noGreen',
        type: ConfigOptionType.Boolean,
        name: 'No Green Effects',
        description: 'Removes the green effects',
        default: false
    },
    {
        id: 'noYellow',
        type: ConfigOptionType.Boolean,
        name: 'No Yellow Effects',
        description: 'Removes the yellow effects',
        default: false
    },
    {
        id: 'lowConflict',
        type: ConfigOptionType.Boolean,
        name: 'No Red Effects (Low Conflict)',
        description: 'Removes the red effects and the Sacrifice effect',
        default: false
    }
]
