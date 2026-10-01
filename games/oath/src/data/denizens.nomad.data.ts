import type { DenizenRecord } from './cardRegistry.js'

export default [
    {
        id: 'denizen.nomad.a-fast-steed',
        name: 'A Fast Steed',
        cardNumber: 172,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Spend no Supply if you have three or fewer warbands on your board.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.ancient-binding',
        name: 'Ancient Binding',
        cardNumber: 23,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 1
        },
        powerText:
            'Action: Each player burns all their [secret] except their last. _(The only [secret] you keep is the one here.)_',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.ancient-bloodline',
        name: 'Ancient Bloodline',
        cardNumber: 165,
        suit: 'nomad',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Your enemies act as if denizens and relics at sites you rule are locked.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.ancient-pact',
        name: 'Ancient Pact',
        cardNumber: 166,
        suit: 'nomad',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When Played, you may give the Chancellor the Darkest Secret to become a Citizen—take any one Reliquary relic without peeking, end your Act Phase, and refresh Supply to full.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.convoys',
        name: 'Convoys',
        cardNumber: 151,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Action: Take another region's discard pile and put it on top of your region's discard pile _(even if empty)_.",
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.elders',
        name: 'Elders',
        cardNumber: 26,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 2,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Action: Gain [secret].',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.faithful-friend',
        name: 'Faithful Friend',
        cardNumber: 28,
        suit: 'nomad',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'When Played, gain 4 Supply.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.family-wagon',
        name: 'Family Wagon',
        cardNumber: 168,
        suit: 'nomad',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'You can only have one adviser that is not a [suit:nomad]. You can have any number of [suit:nomad] advisers—they **ignore** your adviser limit.',
        timing: 'continuous',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.great-crusade',
        name: 'Great Crusade',
        cardNumber: 164,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            '[plusMinus][attackDie] per [suit:nomad] card you rule. At end, discard Great Crusade.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.nomad.great-herd',
        name: 'Great Herd',
        cardNumber: 30,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'When Played, you may swap Great Herd with a [suit:nomad] card at any site.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.horse-archers',
        name: 'Horse Archers',
        cardNumber: 24,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '[plusMinus]3[attackDie] At end, discard Horse Archers.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.nomad.hospitality',
        name: 'Hospitality',
        cardNumber: 171,
        suit: 'nomad',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'After traveling, gain [favor] from one favor bank that matches both a card at your site and one of your advisers.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.lancers',
        name: 'Lancers',
        cardNumber: 154,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Double your total attack roll. At end, discard Lancers.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.nomad.lost-tongue',
        name: 'Lost Tongue',
        cardNumber: 157,
        suit: 'nomad',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Other players **cannot** target or take your relics or banners in any way unless they rule a [suit:nomad] card.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.mountain-giant',
        name: 'Mountain Giant',
        cardNumber: 155,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 1,
            burnSecret: 0
        },
        powerText: '[plusMinus]1[attackDie] or [plusMinus]3[attackDie]. At end, discard.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.nomad.mounted-patrol',
        name: 'Mounted Patrol',
        cardNumber: 163,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'The attacker rolls only half the [attackDie] in their attack pool, rounded down. At end, discard Mounted Patrol.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.nomad.oracle',
        name: 'Oracle',
        cardNumber: 160,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 2,
            burnSecret: 0
        },
        powerText:
            'Action: Draw the Vision closest to the top of the world deck. Play or discard it as if you searched.',
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.pilgrimage',
        name: 'Pilgrimage',
        cardNumber: 161,
        suit: 'nomad',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "When Played, move all denizens at your site to the Dispossessed. Shuffle and draw denizens from the Dispossessed equal to the number you moved. Peek at them and put them on your region's discard pile.",
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.rain-boots',
        name: 'Rain Boots',
        cardNumber: 14,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "**Ignore** all your enemy's rolls of single shields [shield]. At end, discard Rain Boots.",
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'attacker'
    },
    {
        id: 'denizen.nomad.relic-worship',
        name: 'Relic Worship',
        cardNumber: 173,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'After you recover a relic, gain 3 Supply.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'recover',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.resettle',
        name: 'Resettle',
        cardNumber: 159,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Action: Move a faceup [suit:nomad] card from any player's advisers to any site.",
        timing: 'action',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.rival-khan',
        name: 'Rival Khan',
        cardNumber: 156,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            '[plusMinus]4[attackDie] if your enemy has a [suit:nomad] adviser. At end, discard Rival Khan.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    },
    {
        id: 'denizen.nomad.sacred-ground',
        name: 'Sacred Ground',
        cardNumber: 174,
        suit: 'nomad',
        placement: 'site',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Players **cannot** play Visions, except the Conspiracy, faceup unless their pawn is at this site.',
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'search',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.special-envoy',
        name: 'Special Envoy',
        cardNumber: 158,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: 'Spend no Supply. After traveling, end your Act Phase.',
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.spell-breaker',
        name: 'Spell Breaker',
        cardNumber: 162,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Enemies of Spell Breaker's ruler **cannot** use powers that cost any [secret] or [burnSecret].",
        timing: 'persistent',
        persistent: true,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.storm-caller',
        name: 'Storm Caller',
        cardNumber: 167,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: '+2[defenseDie] At end, discard Storm Caller.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.nomad.tents',
        name: 'Tents',
        cardNumber: 29,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 1,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText: "Spend no Supply if you're traveling to a site in your region.",
        timing: 'modifier',
        persistent: false,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.the-gathering',
        name: 'The Gathering',
        cardNumber: 27,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When Played, any players in turn order may put their pawn on this site. Then, players with pawns here may negotiate binding exchanges of [favor], [secret], relics, and advisers.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.twin-brother',
        name: 'Twin Brother',
        cardNumber: 170,
        suit: 'nomad',
        placement: 'adviser',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'When Played, you may swap this card with a faceup [suit:nomad] adviser of another player.',
        timing: 'whenPlayed',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.vow-of-kinship',
        name: 'Vow of Kinship',
        cardNumber: 152,
        suit: 'nomad',
        placement: 'adviser',
        locked: true,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Move all of your [favor] to the [suit:nomad] bank. Any [favor] you gain or take is put in the [suit:nomad] bank. You can use [favor] in the [suit:nomad] bank as if it is on your board.',
        timing: 'continuous',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.warning-signals',
        name: 'Warning Signals',
        cardNumber: 25,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'Move any warbands to and from your board and any sites you rule _(except the last warband from a site)_. At end, discard Warning Signals.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'defender'
    },
    {
        id: 'denizen.nomad.way-station',
        name: 'Way Station',
        cardNumber: 169,
        suit: 'nomad',
        placement: 'site',
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            "Spend no Supply if you're traveling to this site and either rule Way Station or choose to give [favor] to its ruler. _(Give it to Chancellor if Empire, burn it if bandits.)_",
        timing: 'persistent',
        persistent: true,
        modifiesAction: 'travel',
        battlePlanSide: null
    },
    {
        id: 'denizen.nomad.wild-mounts',
        name: 'Wild Mounts',
        cardNumber: 153,
        suit: 'nomad',
        placement: null,
        locked: false,
        cost: {
            placeFavor: 0,
            burnFavor: 0,
            placeSecret: 0,
            burnSecret: 0
        },
        powerText:
            'If you would discard any number of [suit:nomad] battle plans, you may instead discard any one [suit:beast] card you rule.',
        timing: 'battlePlan',
        persistent: false,
        modifiesAction: null,
        battlePlanSide: 'either'
    }
] satisfies readonly DenizenRecord[]
