import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const HexPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        // The board turned a quarter, upright: taller than wide, which suits a phone.
        upright: Type.Boolean()
    },
    { additionalProperties: false }
)

export const HexPreferenceDefinition = {
    title: {
        schema: HexPreferences,
        defaults: {
            showCoordinates: true,
            upright: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof HexPreferences>
