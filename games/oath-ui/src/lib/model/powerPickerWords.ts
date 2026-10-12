/**
 * A power's picks in a few words, the History keeping the context; a pick not named here keeps
 * the engine's words for it. `tone` rings the picked warbands rose where they die, gold where
 * they move. `ownPlace`: the card names the one place its warbands come from (Blood Pact's "on
 * your board"), so the pieces stand beside its words with no place named.
 */
export type PickerWords = {
    player?: string
    warbands?: (total: number) => string
    tone: 'gold' | 'rose'
    ownPlace?: true
}

const WORDS: Record<string, PickerWords> = {
    'relic.whistle': { player: 'Call:', tone: 'gold' },
    'denizen.arcane.terror-spells': { warbands: (total) => `Kill ${total}:`, tone: 'rose' },
    'denizen.arcane.blood-pact': { warbands: () => 'Sacrifice:', tone: 'rose', ownPlace: true }
}

const PLAIN: PickerWords = { tone: 'gold' }

export function pickerWords(cardId: string): PickerWords {
    return WORDS[cardId] ?? PLAIN
}
