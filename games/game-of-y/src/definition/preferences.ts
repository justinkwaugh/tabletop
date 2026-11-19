import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const YPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean()
    },
    { additionalProperties: false }
)

export const YPreferenceDefinition = {
    title: {
        schema: YPreferences,
        defaults: {
            showCoordinates: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof YPreferences>
