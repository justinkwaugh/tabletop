import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const NapoleonsTriumphPreferences = Type.Object(
    {
        darkBorders: Type.Boolean()
    },
    { additionalProperties: false }
)

export const NapoleonsTriumphPreferenceDefinition = {
    title: {
        schema: NapoleonsTriumphPreferences,
        defaults: {
            darkBorders: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof NapoleonsTriumphPreferences>
