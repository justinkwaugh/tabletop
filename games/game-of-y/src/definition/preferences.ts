import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const YPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        looseStones: Type.Boolean(),
        flatBoard: Type.Boolean(),
        hexCells: Type.Boolean()
    },
    { additionalProperties: false }
)

export const YPreferenceDefinition = {
    title: {
        schema: YPreferences,
        defaults: {
            showCoordinates: true,
            looseStones: false,
            flatBoard: true,
            hexCells: true
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof YPreferences>
