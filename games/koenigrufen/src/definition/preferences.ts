import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const KoenigrufenPreferences = Type.Object(
    {
        // Red pip cards marked 10 9 8 7 like the black suits, in place of 1 2 3 4.
        uniformPips: Type.Boolean(),
        // The Industrie und Glück Tarock art, as printed, in place of the indexed Tarot Nouveau.
        classicDeck: Type.Boolean()
    },
    { additionalProperties: false }
)

export type KoenigrufenPreferences = Type.Static<typeof KoenigrufenPreferences>

export const KoenigrufenPreferenceDefinition = {
    title: {
        schema: KoenigrufenPreferences,
        defaults: {
            uniformPips: false,
            classicDeck: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof KoenigrufenPreferences>
