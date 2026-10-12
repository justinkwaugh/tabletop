/**
 * A power's picks in a few words, the History keeping the context; a pick not named here keeps
 * the engine's words for it. `tone` rings the picked warbands rose where they die, gold where
 * they move. `ownPlace`: the card names the one place its warbands come from (Blood Pact's "on
 * your board"), so the pieces stand beside its words with no place named. `site`: the power's
 * site is picked on the lit map; `row` heads it in the panel, and `chip` names it on a lit site.
 */
export type PickerWords = {
    player?: string
    warbands?: (total: number) => string
    tone: 'gold' | 'rose'
    ownPlace?: true
    site?: { row: string; chip: string }
}

const CAMPAIGN_AT = { row: 'Campaign at:', chip: 'Campaign' }

const WORDS: Record<string, PickerWords> = {
    'relic.whistle': { player: 'Call:', tone: 'gold' },
    'denizen.arcane.terror-spells': { warbands: (total) => `Kill ${total}:`, tone: 'rose' },
    'denizen.arcane.blood-pact': { warbands: () => 'Sacrifice:', tone: 'rose', ownPlace: true },
    'denizen.order.captains': { site: CAMPAIGN_AT, tone: 'gold' },
    'denizen.beast.wild-allies': { site: CAMPAIGN_AT, tone: 'gold' },
    'denizen.order.siege-engines': { site: { row: 'Kill 2 at:', chip: 'Kill 2' }, tone: 'gold' },
    'denizen.nomad.resettle': { site: { row: 'Place it at:', chip: 'Place it' }, tone: 'gold' },
    'denizen.order.palanquin': { site: { row: 'Carry to:', chip: 'Carry' }, tone: 'gold' },
    'relic.ivory-eye': { site: { row: 'Peek at:', chip: 'Peek' }, tone: 'gold' }
}

const PLAIN: PickerWords = { tone: 'gold' }

export function pickerWords(cardId: string): PickerWords {
    return WORDS[cardId] ?? PLAIN
}
