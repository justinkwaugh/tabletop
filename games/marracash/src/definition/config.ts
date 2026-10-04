import * as Type from 'typebox'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type MarracashGameConfig = Type.Static<typeof MarracashGameConfig>
export const MarracashGameConfig = Type.Object({
    concealedCash: Type.Boolean(),
    antiqueCards: Type.Boolean()
})

export const MarracashGameConfigOptions: GameConfigOptions = [
    {
        id: 'concealedCash',
        type: ConfigOptionType.Boolean,
        name: 'Concealed Cash',
        description: "Hide each player's cash from the other players until the game ends",
        default: false
    },
    {
        id: 'antiqueCards',
        type: ConfigOptionType.Boolean,
        name: 'Antique Cards',
        description:
            'Deal each player 5 secret antique cards, two of one colour and one each of three others, that pay out when their shops attract matching customers',
        default: true
    }
]
