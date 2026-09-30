import type { RelicRecord } from './relics.js'

export default [
    {
        id: 'relic.bandit-crown',
        name: 'Bandit Crown',
        cardNumber: null,
        defenseDice: 3,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Act as if bandits are your warbands except at sites ruled by enemies. _(You rule empty sites.)_ They **cannot** be killed, moved, or sacrificed.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.book-of-records',
        name: 'Book of Records',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You **must** gain [secret] instead of [favor] when you play to a site.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'relic.brass-horse',
        name: 'Brass Horse',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Reveal the top card of your discard pile. Travel to a site with a card of this suit. If unable, travel as normal. In either case, spend no Supply.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.circlet-of-command',
        name: 'Circlet of Command',
        cardNumber: null,
        defenseDice: 1,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Players **cannot** target or take your banners or your other relics. In campaigns, banishing your pawn and favor adds one more [defenseDie].',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.cracked-horn',
        name: 'Cracked Horn',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You may put all the cards you discard on the bottom of the world deck.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'relic.cup-of-plenty',
        name: 'Cup of Plenty',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Spend no Supply if you're trading with a card that matches any of your advisers.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'relic.cursed-cauldron',
        name: 'Cursed Cauldron',
        cardNumber: null,
        defenseDice: 3,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're victorious, gain one warband per enemy warband killed in this campaign.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'relic.dowsing-sticks',
        name: 'Dowsing Sticks',
        cardNumber: null,
        defenseDice: 3,
        cost: {
            placeFavor: 0,
            burnFavor: 2,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Draw a relic. Take it or put it on the bottom of the relic deck.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.dragonskin-drum',
        name: 'Dragonskin Drum',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'After traveling, gain one warband.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'relic.grand-mask',
        name: 'Grand Mask',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're an Exile, during your turn you rule cards except battle plans at Imperial sites, and Imperial players do not.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.grand-scepter',
        name: 'The Grand Scepter',
        cardNumber: null,
        defenseDice: 5,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            '**You cannot use this if you took it on this turn.**\nAction: Peek in the Imperial Reliquary.\nAction: Offer Citizenship to any Exile, or exile a Citizen except yourself.',
        timing: ['continuous', 'action', 'action'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.horned-mask',
        name: 'Horned Mask',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Swap one of your faceup advisers with a card at your site.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.ivory-eye',
        name: 'Ivory Eye',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Peek at any facedown site, adviser, or relic at any site.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.map',
        name: 'Map',
        cardNumber: null,
        defenseDice: 3,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Put this relic on the bottom of the relic deck to gain 4 Supply.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.obsidian-cage',
        name: 'Obsidian Cage',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're victorious, move all unkilled warbands in your enemy's force to the Obsidian Cage.\nAction: Move any number of warbands from Obsidian Cage to any board of the same color.",
        timing: ['battlePlan', 'action'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'relic.oracular-pig',
        name: 'Oracular Pig',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Peek at the top three cards of the world deck.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.ring-of-devotion',
        name: 'Ring of Devotion',
        cardNumber: null,
        defenseDice: 3,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You **cannot** place warbands at sites. When mustering, you gain two more warbands.',
        timing: 'continuous',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.skeleton-key',
        name: 'Skeleton Key',
        cardNumber: null,
        defenseDice: 3,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 1
        },
        powerText:
            'Action: If the Chancellor rules your site, peek at any one relic in the Imperial Reliquary, and you may take it.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'relic.sticky-fire',
        name: 'Sticky Fire',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're victorious, you may kill all the warbands in your enemy's force. If you do, you **must** give them [favor] if able.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'relic.truthful-harp',
        name: 'Truthful Harp',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You may choose to draw two more cards. If you do, you **must** reveal every card you draw and the card you keep.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'relic.whistle',
        name: 'Whistle',
        cardNumber: null,
        defenseDice: 2,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Choose a pawn at another site. They **must** travel to your site if able, spending no Supply. If they do, give them the [secret] here.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    }
] satisfies readonly RelicRecord[]
