import * as Type from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type ReefEncounterGameConfig = Type.Static<typeof ReefEncounterGameConfig>
export const ReefEncounterGameConfig = Type.Object({
    advanced: Type.Boolean(),
    concealed: Type.Boolean()
})

export const ReefEncounterGameConfigOptions: GameConfigOptions = [
    {
        id: 'advanced',
        type: ConfigOptionType.Boolean,
        name: 'Advanced game',
        description:
            'No extra growth beside the starfish squares, and one more polyp goes back into the bag whenever a coral is eaten',
        default: false
    },
    {
        id: 'concealed',
        type: ConfigOptionType.Boolean,
        name: 'Concealed',
        description:
            "Don't track other players' supplies, larva cubes and parrotfish for you: the panels hide them, as the printed rules do. The history still shows every move, so they can be worked out from it",
        default: false
    }
]
