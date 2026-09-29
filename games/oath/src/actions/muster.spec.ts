import { describe, expect, it } from 'vitest'
import { HydratedMuster, Muster } from './muster.js'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { Color } from '@tabletop/common'
import { expectWarbandsConserved } from '../testing/census.js'
import { buildAction } from '../testing/actions.js'

function muster(playerId: string, cardId: string) {
    return new HydratedMuster(buildAction(Muster, { playerId, cardId }))
}

function ready(overrides = {}) {
    return testState([testPlayer({ siteId: 'c1', favor: 2, ...overrides })], {
        denizensBySite: { c1: ['card-a', 'card-b'] }
    })
}

describe('Muster (R-5.2)', () => {
    it('spends 1 Supply, places one favor on the card, and gains two warbands', () => {
        const state = ready()
        muster('p1', 'card-a').apply(state)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(6)
        expect(p.supplySpentThisTurn).toBe(1)
        expect(p.favor).toBe(1)
        expect(state.tokensOn('card-a')).toEqual({ favor: 1, secrets: 0 })
        // R-10.10 — the two warbands come out of the personal bank.
        expect(p.warbandsOnBoard).toEqual({ [Color.Red]: 2 })
        expect(p.warbandsInPersonalBank).toEqual({ [Color.Red]: 12 })
    })

    it('places the favor on the card rather than returning it to a bank', () => {
        // R-4.3.1 — the favor returns to its bank only at Rest.
        const state = ready()
        const bankBefore = { ...state.favorBank }
        muster('p1', 'card-a').apply(state)
        expect(state.favorBank).toEqual(bankBefore)
    })

    it('refuses a card that already holds favor or secrets', () => {
        const state = ready()
        state.cardTokens['card-a'] = { favor: 1, secrets: 0 }
        expect(() => muster('p1', 'card-a').apply(state)).toThrow(/already has favor or secrets/)

        state.cardTokens['card-b'] = { favor: 0, secrets: 1 }
        expect(() => muster('p1', 'card-b').apply(state)).toThrow(/already has favor or secrets/)
    })

    it('refuses a card that is not at the player’s site', () => {
        const state = ready()
        state.denizensBySite['p1'] = ['elsewhere']
        expect(() => muster('p1', 'elsewhere').apply(state)).toThrow(
            /not a denizen at your site/
        )
    })

    it('refuses when the player has no favor to place', () => {
        const state = ready({ favor: 0 })
        expect(() => muster('p1', 'card-a').apply(state)).toThrow(/requires one favor/)
    })

    it('refuses when Supply is short', () => {
        const state = ready({ supply: 0 })
        expect(() => muster('p1', 'card-a').apply(state)).toThrow(/costs 1 Supply/)
    })

    function citizenAndChancellor(chancellorPurple = 10) {
        return testState(
            [
                testPlayer({
                    playerId: 'citizen',
                    siteId: 'c1',
                    favor: 2,
                    status: PlayerStatus.Citizen,
                    color: Color.Red,
                    warbandsInPersonalBank: { [Color.Red]: 4 }
                }),
                testPlayer({
                    playerId: 'chancellor',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    warbandsInPersonalBank: { [IMPERIAL_COLOR]: chancellorPurple }
                })
            ],
            { denizensBySite: { c1: ['card-a'] }, chancellorPlayerId: 'chancellor' }
        )
    }

    it('gives a Citizen purple warbands, not their own colour (R-5.2.2)', () => {
        const state = citizenAndChancellor()
        const action = muster('citizen', 'card-a')
        action.apply(state)

        expect(action.metadata?.warbandColor).toBe(IMPERIAL_COLOR)
        expect(state.getPlayerState('citizen').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 2 })
    })

    it('draws a Citizen purple out of the CHANCELLOR pool, which is shared', () => {
        const state = citizenAndChancellor()
        muster('citizen', 'card-a').apply(state)

        expect(state.getPlayerState('chancellor').warbandsInPersonalBank).toEqual({
            [IMPERIAL_COLOR]: 8
        })
        expect(state.getPlayerState('citizen').warbandsInPersonalBank).toEqual({
            [Color.Red]: 4
        })
    })

    it('runs a Citizen short when the Chancellor pool is nearly empty (R-9.3)', () => {
        const state = citizenAndChancellor(1)
        const action = muster('citizen', 'card-a')
        action.apply(state)

        expect(action.metadata?.warbandsGained).toBe(1)
        expect(state.getPlayerState('chancellor').warbandsInPersonalBank).toEqual({
            [IMPERIAL_COLOR]: 0
        })
    })

    it('conserves warbands across the Citizen transfer', () => {
        const state = citizenAndChancellor()
        expect(() =>
            expectWarbandsConserved(state, () => {
                muster('citizen', 'card-a').apply(state)
            })
        ).not.toThrow()
    })

    it('takes as many warbands as possible when the bank is short (R-9.3)', () => {
        const state = testState(
            [
                testPlayer({
                    siteId: 'c1',
                    favor: 2,
                    warbandsInPersonalBank: { [Color.Red]: 1 }
                })
            ],
            { denizensBySite: { c1: ['card-a'] } }
        )
        const action = muster('p1', 'card-a')
        action.apply(state)

        expect(action.metadata?.warbandsGained).toBe(1)
        expect(state.getPlayerState('p1').warbandsOnBoard).toEqual({ [Color.Red]: 1 })
        expect(state.getPlayerState('p1').warbandsInPersonalBank).toEqual({ [Color.Red]: 0 })
    })

    it('gains nothing when the personal bank holds none of that colour', () => {
        const state = testState(
            [testPlayer({ siteId: 'c1', favor: 2, warbandsInPersonalBank: {} })],
            { denizensBySite: { c1: ['card-a'] } }
        )
        const action = muster('p1', 'card-a')
        action.apply(state)

        expect(action.metadata?.warbandsGained).toBe(0)
        expect(state.getPlayerState('p1').supply).toBe(6)
    })

    it('lists only cards that can actually be mustered on', () => {
        const state = ready()
        state.cardTokens['card-a'] = { favor: 1, secrets: 0 }
        expect(HydratedMuster.legalCards(state, 'p1')).toEqual(['card-b'])
    })

    it('reports no legal cards when the site is empty', () => {
        const state = testState([testPlayer({ siteId: 'c1', favor: 2 })])
        expect(HydratedMuster.canDoMuster(state, 'p1')).toBe(false)
    })
})
