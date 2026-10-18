import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const NapoleonsTriumphPreferences = Type.Object(
    {
        darkBorders: Type.Boolean(),
        movementTrails: Type.Boolean(),
        localeCapacities: Type.Boolean(),
        actionPanelFolded: Type.Boolean()
    },
    { additionalProperties: false }
)

export const NapoleonsTriumphPreferenceDefinition = {
    title: {
        schema: NapoleonsTriumphPreferences,
        defaults: {
            darkBorders: false,
            movementTrails: false,
            localeCapacities: false,
            actionPanelFolded: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof NapoleonsTriumphPreferences>
