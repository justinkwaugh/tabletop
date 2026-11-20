import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const GipfPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        turned: Type.Boolean(),
        pieceBadges: Type.Boolean()
    },
    { additionalProperties: false }
)

export const GipfPreferenceDefinition = {
    title: {
        schema: GipfPreferences,
        defaults: {
            showCoordinates: true,
            turned: false,
            pieceBadges: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof GipfPreferences>
