import type { DenizenRecord } from './cardRegistry.js'

export default [
    {
        id: 'denizen.beast.animal-host',
        name: 'Animal Host',
        cardNumber: 190,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, gain warbands equal to the total number of [suit:beast] cards _(including Animal Host)_ at any sites _(regardless of rule)_.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.animal-playmates',
        name: 'Animal Playmates',
        cardNumber: 40,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Spend no Supply if you're mustering on a [suit:beast] card.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.birdsong',
        name: 'Birdsong',
        cardNumber: 176,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Spend no Supply if you're trading with a [suit:beast] or [suit:nomad] card.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.bracken',
        name: 'Bracken',
        cardNumber: 197,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "You may put all the cards you discard on the top or bottom of any one discard pile _(even your region's)_.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.errand-boy',
        name: 'Errand Boy',
        cardNumber: 11,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'You may draw from a discard pile in a different region instead of yours.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.fae-merchant',
        name: 'Fae Merchant',
        cardNumber: 180,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Draw a relic and take it. Put any relic you hold except the Grand Scepter on the bottom of the relic deck.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.forest-council',
        name: 'Forest Council',
        cardNumber: 194,
        suit: 'beast',
        placement: 'site',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies of Forest Council's ruler **cannot** trade with or muster from [suit:beast] cards.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.forest-paths',
        name: 'Forest Paths',
        cardNumber: 43,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Spend no Supply and **ignore** the powers of sites if you're traveling to a site with a [suit:beast] card.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.giant-python',
        name: 'Giant Python',
        cardNumber: 186,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Whenever a player attacks you, they **must** declare targets that add an even total _(2, 4, etc.)_ of [defenseDie] to your defense pool.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.grasping-vines',
        name: 'Grasping Vines',
        cardNumber: 178,
        suit: 'beast',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies traveling from any site ruled by Grasping Vines' ruler **must** kill one warband on their board if able.",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.insect-swarm',
        name: 'Insect Swarm',
        cardNumber: 184,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Your enemy's battle plans each have an added cost of [burnFavor].",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.long-lost-heir',
        name: 'Long-Lost Heir',
        cardNumber: 44,
        suit: 'beast',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, if you're an Exile, you may become a Citizen—take no relic, end your Act Phase, and refresh Supply to full _(leftmost)_.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.marsh-spirit',
        name: 'Marsh Spirit',
        cardNumber: 192,
        suit: 'beast',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Players who target this site **cannot** use battle plans.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.memory-of-nature',
        name: 'Memory of Nature',
        cardNumber: 191,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Move a total of X[favor] from any favor banks to the [suit:beast] bank. X is the number of [suit:beast] cards on the map.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.mushrooms',
        name: 'Mushrooms',
        cardNumber: 183,
        suit: 'beast',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "Spend no Supply, but draw only one card _(not three)_ from the bottom of your region's discard pile.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.nature-worship',
        name: 'Nature Worship',
        cardNumber: 175,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: '[plusMinus][attackDie] per [suit:beast] adviser you have.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.beast.new-growth',
        name: 'New Growth',
        cardNumber: 188,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You may play [suit:beast] and [suit:hearth] cards to any site _(that has space)_.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.pied-piper',
        name: 'Pied Piper',
        cardNumber: 182,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "This card **ignores** the adviser limit.\nAction: Move this card to any other player's advisers. Take [favor][favor] from them.",
        timing: ['continuous', 'action'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.rangers',
        name: 'Rangers',
        cardNumber: 45,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            '**Ignore** all skulls [skull] you roll.\n+2[attackDie] if the defense pool has 4+ [defenseDie].',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.beast.roving-terror',
        name: 'Roving Terror',
        cardNumber: 46,
        suit: 'beast',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Discard a denizen card at any other site and move this card there.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.second-chance',
        name: 'Second Chance',
        cardNumber: 181,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Kill one warband on the board of a player who has an [suit:order] or [suit:discord] adviser to gain one warband.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.small-friends',
        name: 'Small Friends',
        cardNumber: 177,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Act as if your pawn is at any site with a [suit:beast] card. _(You may use Trade modifiers there.)_',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.the-old-oak',
        name: 'The Old Oak',
        cardNumber: 42,
        suit: 'beast',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'If trading with The Old Oak for [secret], gain one more [secret] if you have any [suit:beast] advisers.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.threatening-roar',
        name: 'Threatening Roar',
        cardNumber: 179,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, discard all [suit:nomad] and [suit:beast] cards at sites in your region.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.true-names',
        name: 'True Names',
        cardNumber: 41,
        suit: 'beast',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Your enemy **cannot** use battle plans that match any of your advisers against you.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.vow-of-beastkin',
        name: 'Vow of Beastkin',
        cardNumber: 196,
        suit: 'beast',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You **must** muster on a card matching any of your advisers, but you gain one more warband.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.vow-of-poverty',
        name: 'Vow of Poverty',
        cardNumber: 193,
        suit: 'beast',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You **cannot** gain [favor] from Trade.\nRest: If you have no [favor], take [favor][favor] from any one favor bank.',
        timing: ['continuous', 'rest'],
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.vow-of-union',
        name: 'Vow of Union',
        cardNumber: 185,
        suit: 'beast',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'In campaigns, warbands at sites you rule add to your attacking force. You **cannot** travel from a site you rule if any warbands are on your board.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.walled-garden',
        name: 'Walled Garden',
        cardNumber: 195,
        suit: 'beast',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            '[plusMinus][defenseDie] per [suit:beast] card at any sites if this site is targeted.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.beast.war-tortoise',
        name: 'War Tortoise',
        cardNumber: 187,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "**Ignore** all attack or defense added by your enemy's rolls of [sword][sword][skull] or [shield][shield]. _(Any [skull] they roll still kill their warbands.)_",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.beast.wild-allies',
        name: 'Wild Allies',
        cardNumber: 198,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Campaign at any site with a [suit:beast] card. Act as if your pawn is there. Spend no Supply and add your warbands there to your force.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.wild-cry',
        name: 'Wild Cry',
        cardNumber: 189,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'If you play a [suit:beast] card, gain 1 Supply and 2 warbands.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.beast.wolves',
        name: 'Wolves',
        cardNumber: 39,
        suit: 'beast',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Kill one warband _(even yours)_ on any one board.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    }
] satisfies readonly DenizenRecord[]
