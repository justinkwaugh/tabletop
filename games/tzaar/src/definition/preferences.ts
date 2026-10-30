import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const TzaarPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        rotatedBoard: Type.Boolean()
    },
    { additionalProperties: false }
)

export const TzaarPreferenceDefinition = {
    title: {
        schema: TzaarPreferences,
        defaults: {
            showCoordinates: true,
            rotatedBoard: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof TzaarPreferences>
