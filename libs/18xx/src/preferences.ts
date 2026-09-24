import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const EighteenXXPreferences = Type.Object(
    {
        operatingOrderDisplay: Type.Union([Type.Literal('tokens'), Type.Literal('details')]),
        historyOrder: Type.Union([Type.Literal('newestFirst'), Type.Literal('newestLast')]),
        compactPlayerCards: Type.Boolean(),
        tableTopPercent: Type.Number({ minimum: 25, maximum: 65 }),
        spreadsheetHeightPercent: Type.Number({ minimum: 25, maximum: 65 }),
        spreadsheetSplitPercent: Type.Number({ minimum: 25, maximum: 65 }),
        paneLayout: Type.Unknown(),
        theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
        spreadsheetView: Type.Union([Type.Literal('player'), Type.Literal('company')])
    },
    { additionalProperties: false }
)
export const EighteenXXPreferenceDefinition = {
    title: {
        schema: EighteenXXPreferences,
        defaults: {
            paneLayout: null,
            operatingOrderDisplay: 'details',
            historyOrder: 'newestLast',
            spreadsheetView: 'player',
            compactPlayerCards: false,
            theme: 'light',
            spreadsheetSplitPercent: 40,
            spreadsheetHeightPercent: 55,
            tableTopPercent: 35
        },
        version: 1
    },
    family: {
        id: '18xx',
        schema: EighteenXXPreferences,
        defaults: {
            paneLayout: null,
            operatingOrderDisplay: 'details',
            historyOrder: 'newestLast',
            spreadsheetView: 'player',
            compactPlayerCards: false,
            theme: 'light',
            spreadsheetSplitPercent: 40,
            spreadsheetHeightPercent: 55,
            tableTopPercent: 35
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof EighteenXXPreferences>
