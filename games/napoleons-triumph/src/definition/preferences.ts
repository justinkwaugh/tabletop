import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const NapoleonsTriumphPreferences = Type.Object(
    {
        darkBorders: Type.Boolean(),
        movementTrails: Type.Boolean(),
        localeCapacities: Type.Boolean(),
        actionPanelFolded: Type.Boolean(),
        historyOrder: Type.Union([Type.Literal('newestFirst'), Type.Literal('newestLast')])
    },
    { additionalProperties: false }
)

export type HistoryOrder = Type.Static<typeof NapoleonsTriumphPreferences>['historyOrder']

export const NapoleonsTriumphPreferenceDefinition = {
    title: {
        schema: NapoleonsTriumphPreferences,
        defaults: {
            darkBorders: false,
            movementTrails: false,
            localeCapacities: false,
            actionPanelFolded: false,
            historyOrder: 'newestLast'
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof NapoleonsTriumphPreferences>
