import * as Type from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type UrbinoGameConfig = Type.Static<typeof UrbinoGameConfig>
export const UrbinoGameConfig = Type.Object({
    monuments: Type.Boolean()
})

export const UrbinoGameConfigOptions: GameConfigOptions = [
    {
        id: 'monuments',
        type: ConfigOptionType.Boolean,
        name: 'Monuments',
        description:
            'Town Wall (H-H-H, 6 pts), Ducal Palace (P-H-P, 10 pts), and Cathedral (T-P-T, 16 pts) score bonus points. One monument per district; most valuable prevails.',
        default: false
    }
]
