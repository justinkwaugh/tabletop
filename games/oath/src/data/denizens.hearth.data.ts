import type { DenizenRecord } from './cardRegistry.js'

export default [
    {
        id: 'denizen.hearth.a-round-of-ale',
        name: 'A Round of Ale',
        cardNumber: 129,
        suit: 'hearth',
        placement: 'site',
        locked: true,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Return all [favor] and [secret], and flip your [secret], as in the Rest Phase, except for the [favor] here.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.armed-mob',
        name: 'Armed Mob',
        cardNumber: 53,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Action: Discard a faceup adviser from a player who holds the Darkest Secret but not the People's Favor.",
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.awaited-return',
        name: 'Awaited Return',
        cardNumber: 150,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Spend no Supply if you sacrifice one warband from your board.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.ballot-box',
        name: 'Ballot Box',
        cardNumber: 141,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Action: If you're an Exile and have the People's Favor, become a Citizen—take no relic, end your Act Phase, and refresh Supply to full.",
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.book-binders',
        name: 'Book Binders',
        cardNumber: 140,
        suit: 'hearth',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'After another player plays a Vision faceup, you gain [favor][favor] from any one favor bank.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.charming-friend',
        name: 'Charming Friend',
        cardNumber: 131,
        suit: 'hearth',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Take [favor] from a player whose pawn is at your site.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.crop-rotation',
        name: 'Crop Rotation',
        cardNumber: 128,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'If playing to a site, you may discard a denizen there first.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.deed-writer',
        name: 'Deed Writer',
        cardNumber: 146,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Negotiate a binding exchange of [favor], [secret], and ruled sites with any player. Old ruler moves warbands to board, and new ruler moves warbands from board.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.extra-provisions',
        name: 'Extra Provisions',
        cardNumber: 48,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '+[defenseDie]',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.hearth.fabled-feast',
        name: 'Fabled Feast',
        cardNumber: 136,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, take X[favor] equal to the number of [suit:hearth] cards you rule _(including Fabled Feast)_, from any one favor bank.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.family-heirloom',
        name: 'Family Heirloom',
        cardNumber: 133,
        suit: 'hearth',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'When played, draw a relic. Take it or put it on the bottom of the relic deck.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.hearts-and-minds',
        name: 'Hearts and Minds',
        cardNumber: 138,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 3,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "As defender, you're victorious now. At end, discard Hearts and Minds unless you hold the People's Favor.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.hearth.herald',
        name: 'Herald',
        cardNumber: 143,
        suit: 'hearth',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'After another player campaigns against a player _(not bandits)_, you gain [favor] from any favor bank.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.homesteaders',
        name: 'Homesteaders',
        cardNumber: 127,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Move one of your faceup advisers to your site.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.hospital',
        name: 'Hospital',
        cardNumber: 149,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If any of your warbands would be killed, place them on Hospital's site instead if you still rule it.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.hearth.land-warden',
        name: 'Land Warden',
        cardNumber: 130,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You may play two cards you draw _(instead of one)_ if you play at least one card to a site.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.levelers',
        name: 'Levelers',
        cardNumber: 135,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Move [favor][favor] from the favor bank with the most [favor] to that with the least [favor]. You decide ties.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.marriage',
        name: 'Marriage',
        cardNumber: 148,
        suit: 'hearth',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Marriage counts as two [suit:hearth] advisers, but only counts as one toward your adviser limit.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.memory-of-home',
        name: 'Memory of Home',
        cardNumber: 49,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 1
        },
        powerText: 'Action: Move all [favor] from any one favor bank to the [suit:hearth] bank.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.news-from-afar',
        name: 'News from Afar',
        cardNumber: 134,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Spend no Supply.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.relic-breaker',
        name: 'Relic Breaker',
        cardNumber: 139,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Put a facedown relic at your site on the bottom of the relic deck to gain three warbands.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.rowdy-pub',
        name: 'Rowdy Pub',
        cardNumber: 144,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Gain one more warband if mustering from Rowdy Pub.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.saddle-makers',
        name: 'Saddle Makers',
        cardNumber: 142,
        suit: 'hearth',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'After another player plays a [suit:nomad] or [suit:order] card, you gain [favor][favor] from the matching favor bank.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.salad-days',
        name: 'Salad Days',
        cardNumber: 147,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, gain [favor][favor][favor]—one each from three different favor banks.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.storyteller',
        name: 'Storyteller',
        cardNumber: 52,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Place [secret] from the shared bank on the Darkest Secret.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.tavern-songs',
        name: 'Tavern Songs',
        cardNumber: 54,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Action: Peek at the top three cards of your region's discard pile.",
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.the-great-levy',
        name: 'The Great Levy',
        cardNumber: 137,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "[plusMinus]3[attackDie] and **ignore** all skulls [skull] you roll, unless your enemy has the People's Favor.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.hearth.tinkers-fair',
        name: "Tinker's Fair",
        cardNumber: 13,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Negotiate a binding exchange of [favor], [secret], and relics with any player.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.traveling-doctor',
        name: 'Traveling Doctor',
        cardNumber: 51,
        suit: 'hearth',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If you're defeated, kill no warbands in your force and discard Traveling Doctor. **Ignore** powers that kill all of your force.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.hearth.village-constable',
        name: 'Village Constable',
        cardNumber: 132,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "[plusMinus]2[attackDie] unless your enemy has the People's Favor.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.hearth.vow-of-peace',
        name: 'Vow of Peace',
        cardNumber: 145,
        suit: 'hearth',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You **cannot** campaign.\nAttackers **cannot** sacrifice warbands to increase their attack against you.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.wayside-inn',
        name: 'Wayside Inn',
        cardNumber: 47,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Gain 2 Supply.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.hearth.welcoming-party',
        name: 'Welcoming Party',
        cardNumber: 50,
        suit: 'hearth',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'If you play a denizen card that was not a facedown adviser, gain [favor] from the [suit:hearth] bank.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    }
] satisfies readonly DenizenRecord[]
