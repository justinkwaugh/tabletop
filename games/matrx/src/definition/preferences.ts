import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const MatrxPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        centreMark: Type.Boolean()
    },
    { additionalProperties: false }
)

export const MatrxPreferenceDefinition = {
    title: {
        schema: MatrxPreferences,
        defaults: {
            showCoordinates: true,
            centreMark: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof MatrxPreferences>
