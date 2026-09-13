import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const EighteenXXPreferences = Type.Object(
    {
        operatingOrderDisplay: Type.Union([Type.Literal('tokens'), Type.Literal('details')]),
        historyOrder: Type.Union([Type.Literal('newestFirst'), Type.Literal('newestLast')])
    },
    { additionalProperties: false }
)
export const EighteenXXPreferenceDefinition = {
    title: {
        schema: EighteenXXPreferences,
        defaults: { operatingOrderDisplay: 'details', historyOrder: 'newestLast' },
        version: 1
    },
    family: {
        id: '18xx',
        schema: EighteenXXPreferences,
        defaults: { operatingOrderDisplay: 'details', historyOrder: 'newestLast' },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof EighteenXXPreferences>
