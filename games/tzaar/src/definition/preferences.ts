import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const TzaarPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        rotatedBoard: Type.Boolean(),
        turned: Type.Boolean(),
        shrinkStacks: Type.Boolean()
    },
    { additionalProperties: false }
)

export const TzaarPreferenceDefinition = {
    title: {
        schema: TzaarPreferences,
        defaults: {
            showCoordinates: true,
            rotatedBoard: false,
            turned: false,
            shrinkStacks: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof TzaarPreferences>
