import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const LyngkPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean()
    },
    { additionalProperties: false }
)

export const LyngkPreferenceDefinition = {
    title: {
        schema: LyngkPreferences,
        defaults: {
            showCoordinates: true
        },
        version: 2,
        // Version 1 held only the light or dark board, which is gone.
        migrations: { 1: () => ({}) }
    }
} satisfies TitlePreferenceDefinition<typeof LyngkPreferences>
