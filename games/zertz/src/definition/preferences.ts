import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const ZertzPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        turned: Type.Boolean()
    },
    { additionalProperties: false }
)

export const ZertzPreferenceDefinition = {
    title: {
        schema: ZertzPreferences,
        defaults: {
            showCoordinates: true,
            turned: false
        },
        version: 2,
        // Version 1 could show the board straight down, which is gone.
        migrations: {
            1: (values) =>
                Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'tiltedBoard'))
        }
    }
} satisfies TitlePreferenceDefinition<typeof ZertzPreferences>
