import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export enum BoardPerspective {
    Cavalier = 'cavalier',
    TopDown = 'topDown'
}

export const MedinaPreferences = Type.Object(
    {
        boardPerspective: Type.Enum(BoardPerspective)
    },
    { additionalProperties: false }
)

export const MedinaPreferenceDefinition = {
    title: {
        schema: MedinaPreferences,
        defaults: {
            boardPerspective: BoardPerspective.Cavalier
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof MedinaPreferences>
