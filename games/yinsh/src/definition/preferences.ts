import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const YinshPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        turned: Type.Boolean()
    },
    { additionalProperties: false }
)

export const YinshPreferenceDefinition = {
    title: {
        schema: YinshPreferences,
        defaults: {
            showCoordinates: true,
            turned: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof YinshPreferences>
