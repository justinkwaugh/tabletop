import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const LyngkPreferences = Type.Object(
    {
        lightBoard: Type.Boolean()
    },
    { additionalProperties: false }
)

export const LyngkPreferenceDefinition = {
    title: {
        schema: LyngkPreferences,
        defaults: {
            lightBoard: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof LyngkPreferences>
