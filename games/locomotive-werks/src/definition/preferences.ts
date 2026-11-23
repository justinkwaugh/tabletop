import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export enum KindPalette {
    Standard = 'standard',
    ColorBlind = 'colorBlind'
}

export const LwPreferences = Type.Object(
    {
        kindPalette: Type.Enum(KindPalette)
    },
    { additionalProperties: false }
)

export const LwPreferenceDefinition = {
    title: {
        schema: LwPreferences,
        defaults: {
            kindPalette: KindPalette.Standard
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof LwPreferences>
