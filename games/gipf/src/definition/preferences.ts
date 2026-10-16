import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const GipfPreferences = Type.Object(
    {
        lightBoard: Type.Boolean()
    },
    { additionalProperties: false }
)

export const GipfPreferenceDefinition = {
    title: {
        schema: GipfPreferences,
        defaults: {
            lightBoard: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof GipfPreferences>
