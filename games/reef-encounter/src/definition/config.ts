import * as Type from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type ReefEncounterGameConfig = Type.Static<typeof ReefEncounterGameConfig>
export const ReefEncounterGameConfig = Type.Object({
    concealed: Type.Boolean()
})

export const ReefEncounterGameConfigOptions: GameConfigOptions = [
    {
        id: 'concealed',
        type: ConfigOptionType.Boolean,
        name: 'Concealed',
        description:
            "Hide what is behind each player's screen and inside their parrotfish, as the printed rules do",
        default: false
    }
]
