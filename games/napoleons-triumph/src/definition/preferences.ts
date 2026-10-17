import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const NapoleonsTriumphPreferences = Type.Object(
    {
        darkBorders: Type.Boolean(),
        movementTrails: Type.Boolean(),
        localeCapacities: Type.Boolean(),
        battlePanelFolded: Type.Boolean()
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
            battlePanelFolded: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof NapoleonsTriumphPreferences>
