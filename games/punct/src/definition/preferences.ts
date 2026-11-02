import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const PunctPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        showLevels: Type.Boolean(),
        turned: Type.Boolean()
    },
    { additionalProperties: false }
)

export const PunctPreferenceDefinition = {
    title: {
        schema: PunctPreferences,
        defaults: {
            showCoordinates: true,
            showLevels: false,
            turned: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof PunctPreferences>
