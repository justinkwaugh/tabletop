import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const DvonnPreferences = Type.Object(
    {
        graphBoard: Type.Boolean(),
        showCoordinates: Type.Boolean()
    },
    { additionalProperties: false }
)

export const DvonnPreferenceDefinition = {
    title: {
        schema: DvonnPreferences,
        defaults: {
            graphBoard: false,
            showCoordinates: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof DvonnPreferences>
