/**
 * A power's picks in a few words, the History keeping the context; a pick not named here keeps
 * the engine's words for it. `tone` rings the picked warbands rose where they die, gold where
 * they move. `ownPlace`: the card names the one place its warbands come from (Blood Pact's "on
 * your board"), so the pieces stand beside its words with no place named. `site`: the power's
 * site is picked on the lit map; `row` heads it in the panel, and `chip` names it on a lit site.
 * `siteButtons`: the site is picked under its card, a button with the site's name for each.
 * `place`: the words before a pick of one place in a force (Wrestlers' sacrifice), a button for
 * each place ("at Plains", "on your board", another player's board by their chip).
 * `pile`: the words over its discard pile rows. `banks`: the words over a run of favor picks,
 * from the favor the run comes to. `or`: the card's two branches as two answers, the words over
 * them, and the second's consequence in rose. `may`: its toggle row's words, with what the yes
 * gives the Chancellor (`toChancellor`, in gold), and `take` over what only the yes asks for.
 */
export type PickerWords = {
    player?: string
    warbands?: (total: number) => string
    tone: 'gold' | 'rose'
    ownPlace?: true
    site?: { row: string; chip: string }
    siteButtons?: true
    place?: string
    pile?: string
    banks?: (total: number) => string
    or?: { row?: string; first: string; second: string; secondConsequence?: string }
    may?: MayWords
    /** Two facedown adviser picks over the same advisers, answered in one area: its heading. */
    advisers?: string
}

export type MayWords = {
    name: string
    gives: string
    consequence: string
    toChancellor?: string
    take?: string
}

const CAMPAIGN_AT = { row: 'Campaign at:', chip: 'Campaign' }

/** Bracken's "or": the side of the pile a discard goes on. */
export const PILE_SIDES = { first: 'Top', second: 'Bottom' }

// R-6.6.2 — a Citizen by a card: the card's own words for what it brings, and its Act Phase over.
const CITIZEN: MayWords = {
    name: 'Become a Citizen',
    gives: 'Supply to full',
    consequence: 'ends your Act Phase'
}
const CITIZEN_WITH_RELIC: MayWords = {
    ...CITIZEN,
    gives: '+ a relic · Supply to full',
    take: 'Take:'
}

const WORDS: Record<string, PickerWords> = {
    'relic.whistle': { player: 'Call:', tone: 'gold' },
    'denizen.arcane.terror-spells': { warbands: (total) => `Kill ${total}:`, tone: 'rose' },
    'denizen.arcane.blood-pact': { warbands: () => 'Sacrifice:', tone: 'rose', ownPlace: true },
    'denizen.order.wrestlers': { place: 'the warband you sacrifice:', tone: 'rose' },
    'denizen.order.captains': { site: CAMPAIGN_AT, tone: 'gold' },
    'denizen.beast.wild-allies': { site: CAMPAIGN_AT, tone: 'gold' },
    'denizen.order.siege-engines': { site: { row: 'Kill 2 at:', chip: 'Kill 2' }, tone: 'gold' },
    'denizen.nomad.resettle': { site: { row: 'Place it at:', chip: 'Place it' }, tone: 'gold' },
    'denizen.order.palanquin': { site: { row: 'Carry to:', chip: 'Carry' }, tone: 'gold' },
    'relic.ivory-eye': { site: { row: 'Peek at:', chip: 'Peek' }, tone: 'gold' },
    // "Swap any two facedown advisers": both picks in one area, in the card's words.
    'denizen.arcane.dream-thief': { advisers: 'two facedown advisers:', tone: 'gold' },
    'denizen.beast.small-friends': { siteButtons: true, tone: 'gold' },
    'denizen.discord.scryer': { pile: 'Peek at:', tone: 'gold' },
    'denizen.nomad.convoys': { pile: 'Take:', tone: 'gold' },
    'denizen.beast.bracken': { pile: 'To:', or: PILE_SIDES, tone: 'gold' },
    'denizen.arcane.alchemist': { banks: (total) => `Gain ${total} favor:`, tone: 'gold' },
    'denizen.beast.memory-of-nature': {
        banks: (total) => `Move ${total} favor to the beast bank:`,
        tone: 'gold'
    },
    'denizen.hearth.salad-days': { banks: (total) => `Gain favor from ${total}:`, tone: 'gold' },
    'denizen.arcane.forgotten-vault': {
        or: { row: 'Darkest Secret:', first: 'Place secret', second: 'Burn secret' },
        tone: 'gold'
    },
    'denizen.nomad.mountain-giant': {
        or: { first: '±1', second: '±3', secondConsequence: 'discard' },
        tone: 'gold'
    },
    'denizen.beast.long-lost-heir': { may: CITIZEN, tone: 'gold' },
    'denizen.arcane.bewitch': { may: CITIZEN, tone: 'gold' },
    'denizen.discord.royal-ambitions': { may: CITIZEN_WITH_RELIC, tone: 'gold' },
    'denizen.nomad.ancient-pact': {
        may: { ...CITIZEN_WITH_RELIC, toChancellor: 'Darkest Secret' },
        tone: 'gold'
    }
}

const PLAIN: PickerWords = { tone: 'gold' }

export function pickerWords(cardId: string): PickerWords {
    return WORDS[cardId] ?? PLAIN
}
