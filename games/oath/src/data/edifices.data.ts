import type { EdificeRecord } from './edifices.js'

export default [
    {
        id: 'edifice.arcane.great-spire',
        suit: 'arcane',
        placement: 'site',
        locked: true,
        intact: {
            name: 'Great Spire',
            cardNumber: 207,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 1,
                burnSecret: 0
            },
            powerText:
                'You may swap any number of denizens you draw with random cards from the Dispossessed.',
            timing: 'modifier',
            persistent: false,
            modifiesAction: 'search'
        },
        ruined: {
            name: 'Fallen Spire',
            cardNumber: 208,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 1,
                burnSecret: 1
            },
            powerText:
                "Action: Swap up to five denizens from the top of your region's discard pile _(skipping Visions)_ with random cards from the Dispossessed.",
            timing: 'action',
            persistent: false,
            modifiesAction: null
        }
    },
    {
        id: 'edifice.beast.forest-temple',
        suit: 'beast',
        placement: 'site',
        locked: true,
        intact: {
            name: 'Forest Temple',
            cardNumber: 203,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText: 'In the Chronicle, do not discard sites with any [suit:beast] cards.',
            timing: 'persistent',
            persistent: true,
            modifiesAction: null
        },
        ruined: {
            name: 'Ruined Temple',
            cardNumber: 204,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText:
                "Enemies of Ruined Temple's ruler **cannot** play [suit:beast] cards faceup.",
            timing: 'persistent',
            persistent: true,
            modifiesAction: 'search'
        }
    },
    {
        id: 'edifice.discord.festival-district',
        suit: 'discord',
        placement: 'site',
        locked: true,
        intact: {
            name: 'Festival District',
            cardNumber: 205,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText:
                'Action: Negotiate a binding exchange of [favor], [secret], and advisers with any player.',
            timing: 'action',
            persistent: false,
            modifiesAction: null
        },
        ruined: {
            name: 'Squalid District',
            cardNumber: 206,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText:
                "Whenever the [endDie] is rolled to end the game, Squalid District's ruler may increase or decrease this roll by one. Citizens **cannot** use this power.",
            timing: 'persistent',
            persistent: true,
            modifiesAction: null
        }
    },
    {
        id: 'edifice.hearth.hall-of-debate',
        suit: 'hearth',
        placement: 'site',
        locked: true,
        intact: {
            name: 'Hall of Debate',
            cardNumber: 201,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText: "Players **cannot** target the People's Favor.",
            timing: 'persistent',
            persistent: true,
            modifiesAction: 'campaign'
        },
        ruined: {
            name: 'Hall of Mockery',
            cardNumber: 202,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText: "Recovering the People's Favor always flips it to the Mob side.",
            timing: 'persistent',
            persistent: true,
            modifiesAction: 'recover'
        }
    },
    {
        id: 'edifice.nomad.ancient-forge',
        suit: 'nomad',
        placement: 'site',
        locked: true,
        intact: {
            name: 'Ancient Forge',
            cardNumber: 209,
            cost: {
                placeFavor: 2,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 1
            },
            powerText: 'Action: Draw a relic. Take it or put it on the bottom of the relic deck.',
            timing: 'action',
            persistent: false,
            modifiesAction: null
        },
        ruined: {
            name: 'Broken Forge',
            cardNumber: 210,
            cost: {
                placeFavor: 2,
                burnFavor: 0,
                placeSecret: 2,
                burnSecret: 0
            },
            powerText: 'Action: Flip this card over.',
            timing: 'action',
            persistent: false,
            modifiesAction: null
        }
    },
    {
        id: 'edifice.order.sprawling-rampart',
        suit: 'order',
        placement: 'site',
        locked: true,
        intact: {
            name: 'Sprawling Rampart',
            cardNumber: 199,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText:
                "Each site ruled by Sprawling Rampart's ruler adds one more [defenseDie] when targeted.",
            timing: 'persistent',
            persistent: true,
            modifiesAction: 'campaign'
        },
        ruined: {
            name: 'Bandit Rampart',
            cardNumber: 200,
            cost: {
                placeFavor: 0,
                burnFavor: 0,
                placeSecret: 0,
                burnSecret: 0
            },
            powerText: '-2 [attackDie] if this site is targeted.',
            timing: 'battlePlan',
            persistent: false,
            modifiesAction: null,
            battlePlanSide: 'defender'
        }
    }
] satisfies readonly EdificeRecord[]
