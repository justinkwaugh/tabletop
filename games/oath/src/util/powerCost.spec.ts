import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { cardPower, cardPowers, PowerTiming, type CardPower, NO_COST } from '../data/cardPowers.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { expectFavorConserved } from '../testing/census.js'
import { payPowerCost, reasonCannotPayPowerCost, reasonCannotPlaceOn } from './powerCost.js'
import { holdsTheTurn } from './turn.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { HydratedMuster } from '../actions/muster.js'
import { suitOf } from '../data/cardRegistry.js'
import { required } from '../testing/required.js'

const CAPTAINS = required(cardPower('denizen.order.captains', 0), 'denizen.order.captains power 0')
const ALCHEMIST = required(cardPower('denizen.arcane.alchemist', 0), 'denizen.arcane.alchemist power 0')
const WAR_TORTOISE = required(cardPower('denizen.beast.war-tortoise', 0), 'denizen.beast.war-tortoise power 0')
const LONGBOWS = required(cardPower('denizen.order.longbows', 0), 'denizen.order.longbows power 0')
const TUTOR = required(cardPower('denizen.arcane.tutor', 0), 'denizen.arcane.tutor power 0')
const CAGE_ACTION = required(cardPower('relic.obsidian-cage', 1), 'relic.obsidian-cage power 1')

function board(overrides: Parameters<typeof testPlayer>[0] = {}, onTurn = true) {
    const player = testPlayer({
        playerId: 'p1',
        color: Color.Red,
        status: PlayerStatus.Chancellor,
        siteId: 'c1',
        ...overrides
    })
    return testState([player], {
        ...(onTurn
            ? {
                  turnManager: {
                      series: [{ type: 'turn', playerId: 'p1', start: 0 }],
                      turnOrder: ['p1'],
                      turnCounts: { p1: 1 }
                  }
              }
            : {})
    })
}

describe('R-7.1.2 — whether the cost can be paid at all', () => {
    it('a power printing no cost is free to anyone', () => {
        const state = board({ favor: 0, secrets: 0 })
        expect(LONGBOWS.cost.placeFavor).toBe(0)
        expect(reasonCannotPayPowerCost(state, 'p1', LONGBOWS)).toBeUndefined()
    })

    it('refuses when the player has too little favor', () => {
        const state = board({ favor: 0 })
        expect(reasonCannotPayPowerCost(state, 'p1', CAPTAINS)).toBe('costs 1 favor, player has 0')
    })

    it('refuses when the player has too few secrets', () => {
        const state = board({ secrets: 1 })
        expect(reasonCannotPayPowerCost(state, 'p1', ALCHEMIST)).toBe(
            'costs 2 secrets, player has 1 faceup'
        )

        const richer = board({ secrets: 2 })
        expect(reasonCannotPayPowerCost(richer, 'p1', ALCHEMIST)).toBeUndefined()
    })

    it('R-7.1.2.a — facedown secrets cannot pay', () => {
        const state = board({ secrets: 0, secretsFacedown: 5 })
        expect(reasonCannotPayPowerCost(state, 'p1', ALCHEMIST)).toBe(
            'costs 2 secrets, player has 0 faceup'
        )
    })
})

describe('R-7.1.2.a — the occupancy bar', () => {
    it('blocks a card already holding favor', () => {
        const state = board({ favor: 3 })
        state.cardTokens[CAPTAINS.cardId] = { favor: 1, secrets: 0 }
        expect(reasonCannotPayPowerCost(state, 'p1', CAPTAINS)).toBe(
            'denizen.order.captains already has favor or secrets on it'
        )
    })

    it('blocks a card already holding secrets, even paying in favor', () => {
        const state = board({ favor: 3 })
        state.cardTokens[CAPTAINS.cardId] = { favor: 0, secrets: 1 }
        expect(reasonCannotPayPowerCost(state, 'p1', CAPTAINS)).toBeDefined()
    })

    it('does not block a cost that only burns', () => {
        const state = board({ favor: 5 })
        const burnOnly = { ...CAPTAINS, cost: { ...CAPTAINS.cost, placeFavor: 0, burnFavor: 1 } }
        state.cardTokens[CAPTAINS.cardId] = { favor: 1, secrets: 0 }
        expect(reasonCannotPayPowerCost(state, 'p1', burnOnly)).toBeUndefined()
    })

    it('R-5.2.1 — Muster refuses an occupied card with the same reason', () => {
        const state = board({ favor: 3, supply: 7 })
        state.denizensBySite = { c1: ['denizen.order.captains'] }
        state.cardTokens['denizen.order.captains'] = { favor: 1, secrets: 0 }

        expect(HydratedMuster.reasonCannotMuster(state, 'p1', 'denizen.order.captains')).toBe(
            reasonCannotPlaceOn(state, 'denizen.order.captains')
        )
    })
})

describe('R-7.1.2.a-H1 — the bar tests once, before payment', () => {
    it('a cost placing both favor and a secret is payable', () => {
        const state = board({ favor: 4, secrets: 4 })
        expect(TUTOR.cost).toMatchObject({ placeFavor: 1, placeSecret: 1 })
        expect(reasonCannotPayPowerCost(state, 'p1', TUTOR)).toBeUndefined()
    })
})

describe('R-7.5.3 — battle plans are exempt from the bar', () => {
    it('a battle plan may be paid for on an occupied card', () => {
        const state = board({ favor: 3 })
        state.cardTokens[WAR_TORTOISE.cardId] = { favor: 1, secrets: 1 }
        expect(WAR_TORTOISE.timing).toBe(PowerTiming.BattlePlan)
        expect(reasonCannotPayPowerCost(state, 'p1', WAR_TORTOISE)).toBeUndefined()
    })

    it('and does not reach an Action power sharing the card', () => {
        const state = board({ favor: 3, secrets: 3 })
        const plan = required(cardPowers('relic.obsidian-cage')[0], 'the Obsidian Cage plan')
        expect(plan.timing).toBe(PowerTiming.BattlePlan)
        expect(CAGE_ACTION.timing).toBe(PowerTiming.Action)

        const costedAction = {
            ...CAGE_ACTION,
            cost: { ...CAGE_ACTION.cost, placeFavor: 1 }
        }
        const costedPlan = { ...plan, cost: { ...plan.cost, placeFavor: 1 } }
        state.cardTokens['relic.obsidian-cage'] = { favor: 1, secrets: 0 }

        expect(reasonCannotPayPowerCost(state, 'p1', costedPlan)).toBeUndefined()
        expect(reasonCannotPayPowerCost(state, 'p1', costedAction)).toBeDefined()
    })
})

describe('R-7.1.2 — paying it, on your own turn', () => {
    it('places the favor on the card and takes it from the player', () => {
        const state = board({ favor: 2 })
        payPowerCost(state, 'p1', CAPTAINS)

        expect(state.getPlayerState('p1').favor).toBe(1)
        expect(state.tokensOn(CAPTAINS.cardId)).toEqual({ favor: 1, secrets: 0 })
    })

    /** R-9.3 exempts secrets from the component limit, so a burnt secret leaves play. */
    it('R-10.4 — burnt favor reaches the shared bank; burnt secrets leave play', () => {
        const state = board({ favor: 2, secrets: 2 })
        const supplyBefore = state.favorSupply

        const burner = { ...CAPTAINS, cost: { ...CAPTAINS.cost, placeFavor: 0, burnFavor: 1 } }
        payPowerCost(state, 'p1', burner)
        expect(state.favorSupply).toBe(supplyBefore + 1)
        expect(state.tokensOn(CAPTAINS.cardId)).toEqual({ favor: 0, secrets: 0 })

        payPowerCost(state, 'p1', ALCHEMIST)
        expect(state.getPlayerState('p1').secrets).toBe(0)
        expect(state.tokensOn(ALCHEMIST.cardId)).toEqual({ favor: 0, secrets: 1 })
    })

    it('conserves favor across a payment that places and one that burns', () => {
        const state = board({ favor: 4, secrets: 4 })
        expectFavorConserved(state, () => {
            payPowerCost(state, 'p1', CAPTAINS)
            payPowerCost(state, 'p1', {
                ...ALCHEMIST,
                cost: { placeFavor: 0, burnFavor: 1, placeSecret: 0, burnSecret: 0 }
            })
        })
    })

    it('adds to what a card already holds when R-7.5.3 lets it', () => {
        const state = board({ favor: 3 })
        state.cardTokens[WAR_TORTOISE.cardId] = { favor: 1, secrets: 2 }
        payPowerCost(state, 'p1', WAR_TORTOISE)
        expect(state.tokensOn(WAR_TORTOISE.cardId)).toEqual({ favor: 2, secrets: 2 })
    })

    it('throws rather than paying half a cost it cannot afford', () => {
        const state = board({ favor: 0 })
        expect(() => payPowerCost(state, 'p1', CAPTAINS)).toThrow(/Cannot pay power cost/)
        expect(state.tokensOn(CAPTAINS.cardId)).toEqual({ favor: 0, secrets: 0 })
    })
})

describe('R-7.1.2.a — paying outside your turn', () => {
    it('is not the same question as being on the clock', () => {
        const state = board({}, false)
        state.activePlayerIds = ['p1']
        expect(holdsTheTurn(state, 'p1')).toBe(false)
    })

    it('sends placed favor to the bank matching the card’s suit', () => {
        const state = board({ favor: 2 }, false)
        const before = state.favorBank[Suit.Order]

        payPowerCost(state, 'p1', CAPTAINS)

        expect(state.favorBank[Suit.Order]).toBe(before + 1)
        expect(state.tokensOn(CAPTAINS.cardId)).toEqual({ favor: 0, secrets: 0 })
        expect(state.getPlayerState('p1').favor).toBe(1)
    })

    it('flips placed secrets facedown on the payer’s board', () => {
        const state = board({ secrets: 3 }, false)
        payPowerCost(state, 'p1', ALCHEMIST)

        const player = state.getPlayerState('p1')
        expect(player.secrets).toBe(1)
        expect(player.secretsFacedown).toBe(1)
        expect(state.tokensOn(ALCHEMIST.cardId)).toEqual({ favor: 0, secrets: 0 })
    })

    it('and what it flips facedown cannot pay again', () => {
        const state = board({ secrets: 2 }, false)
        payPowerCost(state, 'p1', ALCHEMIST)
        expect(reasonCannotPayPowerCost(state, 'p1', ALCHEMIST)).toBe(
            'costs 2 secrets, player has 0 faceup'
        )
    })

    /** R-7.1.2.a — a relic shows no suit, so no bank can take its out-of-turn favor. */
    it('has no answer for a card with no suit, and says so', () => {
        const state = board({ favor: 4, secrets: 4 }, false)
        expect(() => payPowerCost(state, 'p1', { ...TUTOR, cardId: 'relic.brass-horse' })).toThrow(/shows no suit/)
    })
})

describe('R-7.1.2 — the cost checker and the payer agree', () => {
    const RELIC = 'relic.brass-horse'

    const relicPower: CardPower = {
        cardId: RELIC,
        powerIndex: 0,
        timing: PowerTiming.Action,
        text: 'Action: a power placing favor.',
        cost: { placeFavor: 2, burnFavor: 0, placeSecret: 0, burnSecret: 0 }
    }

    function board() {
        const state = testState(
            [
                testPlayer({ playerId: 'p1', siteId: 'c1' }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c1', favor: 2, relicIds: [RELIC] })
            ]
        )
        openTurn(state, 'p1')
        return state
    }

    it('the checker refuses what the payer cannot pay (suitless, out of turn)', () => {
        const state = board()
        // R-7.1.2.a — out of turn the favor goes to a suit bank; a relic has no suit.
        expect(suitOf(RELIC)).toBeUndefined()
        expect(reasonCannotPayPowerCost(state, 'p2', relicPower)).toMatch(
            /no matching favor bank/
        )
    })

    it('whatever the checker approves, the payer can pay', () => {
        const state = board()
        openTurn(state, 'p2')
        expect(reasonCannotPayPowerCost(state, 'p2', relicPower)).toBeUndefined()
        expect(() => payPowerCost(state, 'p2', relicPower)).not.toThrow()
        expect(state.tokensOn(RELIC).favor).toBe(2)
    })
})

describe('R-7.1.2.a — recorded unruled corner, pinned as current behaviour', () => {
    it('the occupancy bar applies even to an out-of-turn payment whose tokens never land on the card', () => {
        // R-7.1.2.a is read literally: an occupied card refuses even when favor goes to a bank.
        const CARD = 'denizen.hearth.ballot-box'
        const power: CardPower = {
            cardId: CARD,
            powerIndex: 0,
            timing: PowerTiming.Action,
            text: '',
            cost: { ...NO_COST, placeFavor: 1 }
        }
        const state = testState(
            [
                testPlayer({ playerId: 'p1', siteId: 'c1' }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c1', favor: 1 })
            ],
            {
                denizensBySite: { c1: [CARD] },
                cardTokens: { [CARD]: { favor: 1, secrets: 0 } }
            }
        )
        openTurn(state, 'p1')
        expect(reasonCannotPayPowerCost(state, 'p2', power)).toMatch(/already has favor/)
    })
})
