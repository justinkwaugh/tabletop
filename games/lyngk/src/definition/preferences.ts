import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const LyngkPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        turned: Type.Boolean()
    },
    { additionalProperties: false }
)

export const LyngkPreferenceDefinition = {
    title: {
        schema: LyngkPreferences,
        defaults: {
            showCoordinates: true,
            turned: false
        },
        version: 2
    }
} satisfies TitlePreferenceDefinition<typeof LyngkPreferences>
