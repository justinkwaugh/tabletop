import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const ZertzPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean()
    },
    { additionalProperties: false }
)

export const ZertzPreferenceDefinition = {
    title: {
        schema: ZertzPreferences,
        defaults: {
            showCoordinates: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof ZertzPreferences>
