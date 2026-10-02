// R-11 — each site's power in the Buried Giant card library's words. A bracketed token is a symbol
// the library prints: `[suit:<suit>]`, `[favor]`, `[secret]`, `[attackDie]`. Three corrections: the
// Shrouded Wood's "enemy player" (the library FAQ's errata), the Coasts' "power" for "tower", and the
// Wastes' "you take" for "you get take".
const SITE_REFERENCE = new Map<string, string>([
    [
        'site.ancient-city',
        'If you play an [suit:order] card to this site, and you have not discarded an [suit:order] card here during this turn, you get 2 warbands.'
    ],
    [
        'site.barren-coast',
        'When traveling from here to a Coast site, the Travel cost is 1 Supply and you ignore the Narrow Pass power.'
    ],
    [
        'site.buried-giant',
        'When traveling from here, you may flip one secret on your board facedown to spend no Supply and ignore the Narrow Pass power. (Facedown secrets cannot be used to pay a cost.)'
    ],
    [
        'site.charming-valley',
        'When traveling from here, increase the Travel cost by 1 Supply. (For example, traveling from the Provinces costs 3 Supply, not 2 Supply.)'
    ],
    [
        'site.deep-woods',
        'If you play a [suit:beast] card to this site, and you have not discarded a [suit:beast] card here during this turn, you take the relic here, treating this as recovering it.'
    ],
    [
        'site.drowned-city',
        'At the end of your Wake Phase, if your pawn is here, you may take one [secret] from this site.'
    ],
    [
        'site.fertile-valley',
        'If you play a [suit:hearth] card to this site, and you have not discarded a [suit:hearth] card here during this turn, you get [favor].'
    ],
    [
        'site.great-slums',
        'When playing or moving a card to this site, you may discard a card here first.'
    ],
    [
        'site.lush-coast',
        'When traveling from here to a Coast site, the Travel cost is 1 Supply and you ignore the Narrow Pass power.'
    ],
    ['site.marshes', 'When searching, you must draw one fewer card if your pawn is here.'],
    [
        'site.mine',
        'At the end of your Wake Phase, if your pawn is here, you may take one [favor] from this site.'
    ],
    [
        'site.mountain',
        'You must subtract one [attackDie] if you declare any number of targets at this site (even if you rule).'
    ],
    [
        'site.narrow-pass',
        'When traveling from another region to this region, you must Travel to this site. When campaigning, if you declare any targets in this region and your pawn is in a different region, you must target this site unless you rule it.'
    ],
    [
        'site.plains',
        'You must add one [attackDie] if you declare any number of targets at this site (even if you rule).'
    ],
    [
        'site.river',
        'When mustering from a card at this site, you gain one more warband if you rule this site.'
    ],
    [
        'site.rocky-coast',
        'When traveling from here to a Coast site, the Travel cost is 1 Supply and you ignore the Narrow Pass power.'
    ],
    [
        'site.salt-flats',
        'At the end of your Wake Phase, if your pawn is here, you may take one [favor] or [secret] from this site.'
    ],
    [
        'site.shrouded-wood',
        "When traveling from here, the Travel cost is 2 Supply, and you ignore the Narrow Pass and The Hidden Place powers. If an enemy player rules here, you travel to the site of the ruler's choice (Chancellor's choice if ruled by the Empire), even if another player is making you travel."
    ],
    [
        'site.standing-stones',
        'If you play an [suit:arcane] card to this site, and you have not discarded an [suit:arcane] card here during this turn, you get [secret].'
    ],
    [
        'site.steppe',
        'If you play a [suit:nomad] card to this site, and you have not discarded a [suit:nomad] card here during this turn, you get [secret].'
    ],
    [
        'site.the-hidden-place',
        'You cannot travel to here or declare campaign targets here unless you flip one secret on your board facedown.'
    ],
    [
        'site.the-tribunal',
        'Action: If you rule this site or your pawn is here, negotiate a binding exchange of [favor] and [secret] as well as binding actions at any future time, in any combination, with any player. (Be as creative as you want with your agreement and your agreed-upon penalties if someone breaks it!)'
    ],
    [
        'site.wastes',
        'If you play a [suit:discord] card to this site, and you have not discarded a [suit:discord] card here during this turn, you take the relic here, treating this as recovering it.'
    ]
])

/** R-11 — what a site does, or undefined for a card that is not a site. */
export function siteReference(cardId: string): string | undefined {
    return SITE_REFERENCE.get(cardId)
}
