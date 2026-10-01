// R-2.3 — printed on the Imperial Reliquary placard, not on cards.

export interface ReliquaryModifier {
    id: string
    name: string
    powerText: string
}

/** In placard order; R-1.17 deals onto the spaces positionally. */
export const RELIQUARY_MODIFIERS: readonly ReliquaryModifier[] = [
    {
        id: 'reliquary.brutal',
        name: 'Brutal',
        powerText:
            "If you're the attacker, the defeated player (even you) must kill all the warbands in their force."
    },
    {
        id: 'reliquary.decadent',
        name: 'Decadent',
        powerText:
            "Spend no Supply if you're traveling to a site in the Cradle from a site in the Provinces or Hinterland. " +
            "If you're traveling to a site in the Hinterland, increase the Travel cost by 1 Supply."
    },
    {
        id: 'reliquary.careless',
        name: 'Careless',
        powerText:
            'You gain one more favor (even when trading for secrets). ' +
            'You must gain one less secret when trading for secrets.'
    },
    {
        id: 'reliquary.greedy',
        name: 'Greedy',
        powerText:
            'Draw two more cards. (Stop after a Vision as normal.) ' +
            'You cannot search if you would spend more than 2 Supply.'
    }
]

export function reliquaryModifier(index: number): ReliquaryModifier | undefined {
    return RELIQUARY_MODIFIERS[index]
}
