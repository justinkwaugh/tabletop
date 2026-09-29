import type { DenizenRecord } from './cardRegistry.js'

export default [
    {
        id: 'denizen.discord.a-small-favor',
        name: 'A Small Favor',
        cardNumber: 15,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'When played, gain four warbands.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.assassin',
        name: 'Assassin',
        cardNumber: 80,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You can only have two advisers.\nAction: Discard a faceup adviser of a player whose pawn is at your site.',
        timing: ['continuous', 'action'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.bandit-chief',
        name: 'Bandit Chief',
        cardNumber: 100,
        suit: 'discord',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, kill one warband at each site. While Bandit Chief is faceup, each site has two more bandits.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.beast-tamer',
        name: 'Beast Tamer',
        cardNumber: 90,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Enemies **cannot** use [suit:beast] or [suit:nomad] battle plans against you.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.blackmail',
        name: 'Blackmail',
        cardNumber: 82,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, choose a relic held by a player whose pawn is at your site. You take the relic unless they give you [favor][favor][favor].',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.boiling-lake',
        name: 'Boiling Lake',
        cardNumber: 94,
        suit: 'discord',
        placement: 'site',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'If you travel to this site and do not rule this card, you **must** kill two warbands on your board if able.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.book-burning',
        name: 'Book Burning',
        cardNumber: 22,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're victorious and targeted the defender's pawn, they also burn all of the [secret] on their board except their last.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.discord.chaos-cult',
        name: 'Chaos Cult',
        cardNumber: 101,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'After another player takes the Oathkeeper title, you take [favor] from them.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.charlatan',
        name: 'Charlatan',
        cardNumber: 79,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'When played, burn all [secret] but one from the Darkest Secret.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.cracked-sage',
        name: 'Cracked Sage',
        cardNumber: 83,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 1,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: '[plusMinus]4[attackDie] if your enemy has an [suit:arcane] adviser.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.discord.disgraced-captain',
        name: 'Disgraced Captain',
        cardNumber: 20,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 1,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '+4[attackDie] if targeting a site that has an [suit:order] card.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.discord.dissent',
        name: 'Dissent',
        cardNumber: 84,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, each player, except the holder of the People's Favor, places one [favor] on this card for each suit of card they rule.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.downtrodden',
        name: 'Downtrodden',
        cardNumber: 81,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Gain two more warbands if mustering on a card whose favor bank has the least [favor] _(not tied)_.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.enchantress',
        name: 'Enchantress',
        cardNumber: 96,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 1
        },
        powerText: 'Action: Swap this card with any faceup adviser.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.false-prophet',
        name: 'False Prophet',
        cardNumber: 85,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, if you're an Exile, gain one warband and put it on any revealed Vision. You now also have it revealed. If it is ever discarded, kill the warband and play or discard the Vision as if you had searched.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.gambling-hall',
        name: 'Gambling Hall',
        cardNumber: 93,
        suit: 'discord',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Roll 4[defenseDie] and take X[favor] equal to the total [shield] result from any one favor bank.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.gossip',
        name: 'Gossip',
        cardNumber: 99,
        suit: 'discord',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Enemies of Gossip's ruler **cannot** play cards as facedown advisers.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.insomnia',
        name: 'Insomnia',
        cardNumber: 97,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You can only have two advisers.\nRest: Gain [secret].',
        timing: ['continuous', 'rest'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.key-to-the-city',
        name: 'Key to the City',
        cardNumber: 18,
        suit: 'discord',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, if the ruler's pawn is not at this site, kill any warbands at this site, then gain a warband and place it here.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.mercenaries',
        name: 'Mercenaries',
        cardNumber: 12,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "[plusMinus]3[attackDie] If you're defeated while using this power, discard Mercenaries.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.discord.naysayers',
        name: 'Naysayers',
        cardNumber: 21,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Rest: If any Exile is the Oathkeeper or Usurper, take [favor] from the Chancellor.',
        timing: 'rest',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.relic-thief',
        name: 'Relic Thief',
        cardNumber: 95,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'After a player takes any relics and their pawn is in your region, you may use this power to roll one [defenseDie] per relic taken. If you roll no [shield]/[shield][shield], take the relics.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.riots',
        name: 'Riots',
        cardNumber: 91,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, if the People's Favor is on the Mob side, discard all other cards of the most common suit on the map. If there is a tie, you choose among the tied suits.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.royal-ambitions',
        name: 'Royal Ambitions',
        cardNumber: 88,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, if you're an Exile and rule more sites than the Chancellor, you may become a Citizen—take any one Reliquary relic without peeking, end your Act Phase, and refresh Supply to full.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.salt-the-earth',
        name: 'Salt the Earth',
        cardNumber: 89,
        suit: 'discord',
        placement: 'site',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "You **cannot** play Salt the Earth to a site with any locked cards.\nWhen played, **ignore** this site's capacity. Discard all other denizens at this site. This site's capacity is now 1.",
        timing: ['continuous', 'whenPlayed'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.scryer',
        name: 'Scryer',
        cardNumber: 19,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Peek at any one discard pile.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.second-wind',
        name: 'Second Wind',
        cardNumber: 16,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 1,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "After you're victorious, you may travel and then may campaign, spending no Supply for either.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.discord.silver-tongue',
        name: 'Silver Tongue',
        cardNumber: 92,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You can only have two advisers.\nRest: Take [favor] from a favor bank matching a card at your site.',
        timing: ['continuous', 'rest'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.slander',
        name: 'Slander',
        cardNumber: 102,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're victorious and targeted the defender's pawn, they burn all of the [favor] on their board _(not half)_.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.discord.sleight-of-hand',
        name: 'Sleight of Hand',
        cardNumber: 17,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Take [secret] from a player whose pawn is at your site. You **cannot** take their last [secret].',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.sneak-attack',
        name: 'Sneak Attack',
        cardNumber: 98,
        suit: 'discord',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "After another player's campaign, you may campaign, spending no Supply, if you declare them as the defender.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.vow-of-renewal',
        name: 'Vow of Renewal',
        cardNumber: 86,
        suit: 'discord',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "You **cannot** recover the People's Favor. Whenever any player burns [favor], you take the [favor] instead.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.discord.zealots',
        name: 'Zealots',
        cardNumber: 87,
        suit: 'discord',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'If the defending force is larger than your force, each warband you sacrifice will add three _(not one)_ to your attack.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    }
] satisfies readonly DenizenRecord[]
