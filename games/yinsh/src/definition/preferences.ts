import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const YinshPreferences = Type.Object(
    {
        lightBoard: Type.Boolean(),
        showCoordinates: Type.Boolean()
    },
    { additionalProperties: false }
)

export const YinshPreferenceDefinition = {
    title: {
        schema: YinshPreferences,
        defaults: {
            lightBoard: true,
            showCoordinates: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof YinshPreferences>
