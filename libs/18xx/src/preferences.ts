import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const EighteenXXPreferences = Type.Object(
    {
        operatingOrderDisplay: Type.Union([Type.Literal('tokens'), Type.Literal('details')]),
        historyOrder: Type.Union([Type.Literal('newestFirst'), Type.Literal('newestLast')]),
        compactPlayerCards: Type.Boolean(),
        theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
        spreadsheetView: Type.Union([Type.Literal('player'), Type.Literal('company')])
    },
    { additionalProperties: false }
)
export const EighteenXXPreferenceDefinition = {
    title: {
        schema: EighteenXXPreferences,
        defaults: { operatingOrderDisplay: 'details', historyOrder: 'newestLast', spreadsheetView: 'player', compactPlayerCards: false, theme: 'light' },
        version: 1
    },
    family: {
        id: '18xx',
        schema: EighteenXXPreferences,
        defaults: { operatingOrderDisplay: 'details', historyOrder: 'newestLast', spreadsheetView: 'player', compactPlayerCards: false, theme: 'light' },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof EighteenXXPreferences>
