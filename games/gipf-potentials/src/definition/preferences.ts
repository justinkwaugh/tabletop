import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const GipfPotentialsPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        centreMark: Type.Boolean()
    },
    { additionalProperties: false }
)

export const GipfPotentialsPreferenceDefinition = {
    title: {
        schema: GipfPotentialsPreferences,
        defaults: {
            showCoordinates: true,
            centreMark: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof GipfPotentialsPreferences>
