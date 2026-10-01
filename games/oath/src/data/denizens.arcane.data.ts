import type { DenizenRecord } from './cardRegistry.js'

export default [
    {
        id: 'denizen.arcane.acting-troupe',
        name: 'Acting Troupe',
        cardNumber: 36,
        suit: 'arcane',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Act as if the Acting Troupe is a [suit:beast] or [suit:order] card instead.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.alchemist',
        name: 'Alchemist',
        cardNumber: 9,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 1
        },
        powerText: 'Action: Gain [favor][favor][favor][favor] from any favor bank or banks.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.augury',
        name: 'Augury',
        cardNumber: 56,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Draw one more card. _(Stop after a Vision as normal.)_',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.bewitch',
        name: 'Bewitch',
        cardNumber: 67,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When played, if you're an Exile and have more [secret] _(even on cards)_ than the Chancellor, you may become a Citizen—take no relic, end your Act Phase, and refresh Supply to full.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.billowing-fog',
        name: 'Billowing Fog',
        cardNumber: 59,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "If you're defeated, kill no warbands in your force. Ignore powers that kill all of your force.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.arcane.blood-pact',
        name: 'Blood Pact',
        cardNumber: 62,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Sacrifice an even number of warbands on your board. For every two you sacrifice, gain [secret].',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.cracking-ground',
        name: 'Cracking Ground',
        cardNumber: 71,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 1
        },
        powerText: '[plusMinus][attackDie] per site targeted.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.arcane.dazzle',
        name: 'Dazzle',
        cardNumber: 35,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, discard all [suit:hearth] and [suit:order] cards at sites in your region.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.dream-thief',
        name: 'Dream Thief',
        cardNumber: 70,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Swap any two facedown advisers.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.fire-talkers',
        name: 'Fire Talkers',
        cardNumber: 31,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: '[plusMinus]3[attackDie] if you hold the Darkest Secret.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.arcane.forgotten-vault',
        name: 'Forgotten Vault',
        cardNumber: 75,
        suit: 'arcane',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Place [secret] from the shared bank on the Darkest Secret, or burn [secret] from the Darkest Secret _(not last [secret])_.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.gleaming-armor',
        name: 'Gleaming Armor',
        cardNumber: 66,
        suit: 'arcane',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Your enemy's battle plans have an added cost of [secret].",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.initiation-rite',
        name: 'Initiation Rite',
        cardNumber: 73,
        suit: 'arcane',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'To muster, you must place [secret] instead of [favor].',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'muster',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.inquisitor',
        name: 'Inquisitor',
        cardNumber: 38,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Action: Peek at an adviser of a player whose pawn is at your site. If it is the Conspiracy, you play it or discard it. If it is not, give them the [favor] here.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.jinx',
        name: 'Jinx',
        cardNumber: 68,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'If you rule Jinx, after you roll [attackDie] or [defenseDie] for any reason, you may use this power to reroll all those dice once. _(This is not a battle plan!)_',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.kindred-warriors',
        name: 'Kindred Warriors',
        cardNumber: 60,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Ignore all skulls [skull] you roll.\n[plusMinus]X[attackDie] up to the number of other suits you rule.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.arcane.magicians-code',
        name: "Magician's Code",
        cardNumber: 32,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "If recovering the Darkest Secret, gain [secret][secret] and add them to any other [secret] you're paying to recover it _(even none)_.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'recover',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.map-library',
        name: 'Map Library',
        cardNumber: 76,
        suit: 'arcane',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'While your pawn is at this site, you may trade with a card at any site in your region.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.master-of-disguise',
        name: 'Master of Disguise',
        cardNumber: 78,
        suit: 'arcane',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "Act as if you had another player's advisers instead. _(You can't use your other advisers.)_",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.observatory',
        name: 'Observatory',
        cardNumber: 64,
        suit: 'arcane',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'While your pawn is here, you may draw from any one discard pile.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.plague-engines',
        name: 'Plague Engines',
        cardNumber: 65,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 1
        },
        powerText:
            'Action: Each player _(even you)_ places one [favor] per site they rule into the [suit:arcane] bank.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.portal',
        name: 'Portal',
        cardNumber: 58,
        suit: 'arcane',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "Spend no Supply and ignore the powers of sites if you're traveling to or from this site.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.revelation',
        name: 'Revelation',
        cardNumber: 63,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When played, each player, following turn order, may burn any number of [favor] to gain an equal number of [secret].',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.rusting-ray',
        name: 'Rusting Ray',
        cardNumber: 57,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            "If you hold the Darkest Secret, **ignore** all your enemy's rolls of hollow swords [hollowSword].",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.arcane.sealing-ward',
        name: 'Sealing Ward',
        cardNumber: 72,
        suit: 'arcane',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Your relics add one more [defenseDie] when targeted.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'campaign',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.secret-signal',
        name: 'Secret Signal',
        cardNumber: 55,
        suit: 'arcane',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'If you gain only one [favor], gain one more [favor].',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'trade',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.spirit-snare',
        name: 'Spirit Snare',
        cardNumber: 33,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Take [favor] from any one favor bank.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.taming-charm',
        name: 'Taming Charm',
        cardNumber: 37,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Discard a [suit:beast] or [suit:nomad] card at your site to gain [favor][favor] from the matching favor bank.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.terror-spells',
        name: 'Terror Spells',
        cardNumber: 61,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Kill any two warbands in your region _(at sites or on boards, even yours)_ if you hold the Darkest Secret.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.tutor',
        name: 'Tutor',
        cardNumber: 69,
        suit: 'arcane',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: 'Action: Gain [secret].',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.vow-of-silence',
        name: 'Vow of Silence',
        cardNumber: 74,
        suit: 'arcane',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You cannot recover the Darkest Secret or give anyone [secret]. Whenever a player recovers it, you gain X[secret] equal to the number of [secret] they placed.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'recover',
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.witchs-bargain',
        name: "Witch's Bargain",
        cardNumber: 77,
        suit: 'arcane',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText:
            'Action: Give [secret] to a player whose pawn is at your site to take [favor][favor] from them, or give [favor][favor] for [secret], any number of times.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.arcane.wizard-school',
        name: 'Wizard School',
        cardNumber: 34,
        suit: 'arcane',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Gain [secret], then end your Act Phase.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    }
] satisfies readonly DenizenRecord[]
