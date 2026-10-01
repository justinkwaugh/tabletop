import type { DenizenRecord } from './cardRegistry.js'

export default [
    {
        id: 'denizen.order.battle-honors',
        name: 'Battle Honors',
        cardNumber: 2,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "If you're victorious, gain [favor][favor] from the [suit:order] bank.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.bear-traps',
        name: 'Bear Traps',
        cardNumber: 3,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "-[attackDie] Kill one warband on the attacker's board.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.order.captains',
        name: 'Captains',
        cardNumber: 115,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Campaign at any site you rule. Act as if your pawn is there. Spend no Supply and add your warbands there to your force.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.code-of-honor',
        name: 'Code of Honor',
        cardNumber: 103,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '[plusMinus]2[attackDie] but you cannot use other battle plans.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.council-seat',
        name: 'Council Seat',
        cardNumber: 123,
        suit: 'order',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "If you're a Citizen, you cannot be exiled, even by yourself.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.curfew',
        name: 'Curfew',
        cardNumber: 119,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies cannot trade with cards ruled by Curfew's ruler unless they give [favor] to its ruler. _(Give it to Chancellor if Empire, burn it if bandits.)_",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.encirclement',
        name: 'Encirclement',
        cardNumber: 124,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "[plusMinus]2[attackDie] if your force is larger than your enemy's.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.field-promotion',
        name: 'Field Promotion',
        cardNumber: 106,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "If you're victorious, gain three warbands.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.forced-labor',
        name: 'Forced Labor',
        cardNumber: 112,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies cannot search if their pawn is at any site ruled by Forced Labor's ruler unless they give [favor] to its ruler. _(Give it to Chancellor if Empire, burn it if bandits.)_",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.garrison',
        name: 'Garrison',
        cardNumber: 7,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, gain one warband per site you rule, and put one warband from your board on each site you rule.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.hunting-party',
        name: 'Hunting Party',
        cardNumber: 122,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'After searching the world deck, you may campaign, spending no Supply.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.keep',
        name: 'Keep',
        cardNumber: 5,
        suit: 'order',
        placement: 'site',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '+2[defenseDie] if this site is targeted.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.order.knights-errant',
        name: 'Knights Errant',
        cardNumber: 120,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'After mustering, you may campaign, spending no Supply.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.longbows',
        name: 'Longbows',
        cardNumber: 4,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '[plusMinus][attackDie]',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.martial-culture',
        name: 'Martial Culture',
        cardNumber: 10,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're an Exile and defeat another Exile, you may become a Citizen—take no relic, end your Act Phase, and refresh Supply to full _(leftmost)_.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.messenger',
        name: 'Messenger',
        cardNumber: 105,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Move any warbands to and from your board and any sites you rule _(except the last warband from a site)_.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.military-parade',
        name: 'Military Parade',
        cardNumber: 109,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're victorious, gain [favor] from the favor banks matching each adviser of your enemy _(including Imperial Allies)_.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.outriders',
        name: 'Outriders',
        cardNumber: 104,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Ignore all skulls [skull] you roll.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.order.palanquin',
        name: 'Palanquin',
        cardNumber: 107,
        suit: 'order',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Choose a player whose pawn is at your site. Put your pawn on a site that they can travel to. Make them travel to that site, spending no Supply.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.peace-envoy',
        name: 'Peace Envoy',
        cardNumber: 125,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "You cannot use other battle plans. If your enemy's pawn is at your site, give them one [favor] per [defenseDie] in the pool. You're victorious now. Ignore killing warbands.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.order.pressgangs',
        name: 'Pressgangs',
        cardNumber: 6,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You can muster on cards that have [favor] or [secret] on them.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.relic-hunter',
        name: 'Relic Hunter',
        cardNumber: 126,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You may target facedown relics at targeted sites, adding 1[defenseDie] per relic. You may put any relics you take on the bottom of the relic deck.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.order.royal-tax',
        name: 'Royal Tax',
        cardNumber: 117,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, take [favor][favor] from each player whose pawn is at a site you rule in your pawn's region.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.scouts',
        name: 'Scouts',
        cardNumber: 8,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Gain 1 Supply.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.order.secret-police',
        name: 'Secret Police',
        cardNumber: 113,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies cannot play Visions faceup while their pawn is at any site ruled by Secret Police's ruler.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.shield-wall',
        name: 'Shield Wall',
        cardNumber: 108,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "+2[defenseDie] If you're defeated, kill all of your force.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.order.siege-engines',
        name: 'Siege Engines',
        cardNumber: 116,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Kill two warbands _(even yours)_ at any one site in your region.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.specialist',
        name: 'Specialist',
        cardNumber: 114,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'The defender cannot use battle plans.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.order.toll-roads',
        name: 'Toll Roads',
        cardNumber: 118,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies cannot travel to sites ruled by Toll Roads' ruler unless they give [favor] to its ruler. _(Give it to Chancellor if Empire, burn it if bandits.)_",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.tome-guardians',
        name: 'Tome Guardians',
        cardNumber: 110,
        suit: 'order',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies of Tome Guardians' ruler cannot target or take the Darkest Secret in any way.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.tyrant',
        name: 'Tyrant',
        cardNumber: 111,
        suit: 'order',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You must kill a warband _(even your own)_ at the site you travel to, if able.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.order.vow-of-obedience',
        name: 'Vow of Obedience',
        cardNumber: 121,
        suit: 'order',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You cannot play Visions faceup.\nRest: Take [favor] from any one favor bank.',
        timing: ['continuous', 'rest'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.order.wrestlers',
        name: 'Wrestlers',
        cardNumber: 1,
        suit: 'order',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '+[defenseDie] if you sacrifice one warband in your force.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    }
] satisfies readonly DenizenRecord[]
