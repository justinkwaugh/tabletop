import { describe, expect, it } from 'vitest'
import { gainFavorFromBank, giveFavor, removeFavorFromBoard, settleBoardFavor, spendFavor, takeFavorFromPlayer, usableFavor } from './favor.js'
import { expectFavorConserved, expectFullFavorComplement, favorCensus } from '../testing/census.js'
import { Banner, Suit, TOTAL_FAVOR } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedRecover, RecoverTargetKind, Recover } from '../actions/recover.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { FILLER as ORDER_CARD } from '../testing/cards.js'

/** R-1.4 — all 36 favor. */
function fullComplement(playerOverrides = {}, stateOverrides = {}) {
    return testState(
        [testPlayer({ siteId: 'c1', favor: 4, secrets: 3, supply: 7, ...playerOverrides })],
        {
            denizensBySite: { c1: [ORDER_CARD] },
            // 18 suit banks + 4 board + 1 banner + 2 on a card + 11 shared = 36.
            favorSupply: 11,
            cardTokens: { 'denizen.beast.rangers': { favor: 2, secrets: 0 } },
            ...stateOverrides
        }
    )
}

describe('the favor census (R-1.4, R-9.3)', () => {
    it('counts every place a favor token can sit', () => {
        expect(favorCensus(fullComplement())).toBe(TOTAL_FAVOR)
        expect(() => expectFullFavorComplement(fullComplement())).not.toThrow()
    })

    it('counts favor stacked on the People\'s Favor (R-2.5.2)', () => {
        const state = fullComplement()
        const before = favorCensus(state)
        state.banners[Banner.PeoplesFavor].value += 3
        expect(favorCensus(state)).toBe(before + 3)
    })

    it('does not count the Darkest Secret, whose value is secrets', () => {
        const state = fullComplement()
        const before = favorCensus(state)
        state.banners[Banner.DarkestSecret].value += 5
        expect(favorCensus(state)).toBe(before)
    })

    it('fails loudly on a state missing part of the complement', () => {
        const state = fullComplement()
        state.favorSupply -= 1
        expect(() => expectFullFavorComplement(state)).toThrow(/found 35/)
    })
})

describe('favor conservation across real actions', () => {
    it('holds when Trade places favor on a card (R-5.3.2)', () => {
        const state = fullComplement()
        expect(() =>
            expectFavorConserved(state, () => {
                new HydratedTrade(
                    buildAction(Trade, {
                        playerId: 'p1',
                        cardId: ORDER_CARD,
                        option: TradeOption.ForSecrets
                    })
                ).apply(state)
            })
        ).not.toThrow()
    })

    it('holds when Muster moves favor from a board onto a card (R-5.2.1)', () => {
        const state = fullComplement()
        expect(() =>
            expectFavorConserved(state, () => {
                new HydratedMuster(
                    buildAction(Muster, {
                        playerId: 'p1',
                        cardId: ORDER_CARD
                    })
                ).apply(state)
            })
        ).not.toThrow()
    })

    it('holds when a banner Recover scatters favor across the banks (R-5.4.4)', () => {
        // 18 suit banks + 6 board + 2 banner + 2 on a card + 8 shared = 36.
        const state = fullComplement({ favor: 6 }, { favorSupply: 8 })
        state.banners[Banner.PeoplesFavor].value = 2

        expect(favorCensus(state)).toBe(TOTAL_FAVOR)
        expect(() =>
            expectFavorConserved(state, () => {
                new HydratedRecover(
                    buildAction(Recover, {
                        playerId: 'p1',
                        target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
                        amountPaid: 3,
                        redistributeFrom: Suit.Order
                    })
                ).apply(state)
            })
        ).not.toThrow()
        expect(favorCensus(state)).toBe(TOTAL_FAVOR)
    })

    it('holds when favor is BURNED — it goes to the shared bank, not away', () => {
        // R-10.4
        const state = fullComplement()
        const supplyBefore = state.favorSupply

        expect(() =>
            expectFavorConserved(state, () => {
                const p = state.getPlayerState('p1')
                p.favor -= 2
                state.favorSupply += 2
            })
        ).not.toThrow()
        expect(state.favorSupply).toBe(supplyBefore + 2)
    })

    it('catches favor conjured from nowhere', () => {
        const state = fullComplement()
        expect(() =>
            expectFavorConserved(state, () => {
                state.getPlayerState('p1').favor += 2
            })
        ).toThrow(/36 -> 38/)
    })

    it('catches favor dropped on the floor by a burn with no destination', () => {
        const state = fullComplement()
        expect(() =>
            expectFavorConserved(state, () => {
                state.getPlayerState('p1').favor -= 2
            })
        ).toThrow(/36 -> 34/)
    })
})

describe('the one way favor reaches and leaves a player', () => {
    const KINSHIP = { cardId: 'denizen.nomad.vow-of-kinship', faceUp: true }
    const two = (p1 = {}, p2 = {}) =>
        testState([
            testPlayer({ playerId: 'p1', siteId: 'c1', favor: 4, ...p1 }),
            testPlayer({ playerId: 'p2', siteId: 'c1', favor: 1, ...p2 })
        ])

    it('with no power in the way, usable favor is the board and every verb moves board favor', () => {
        const state = two()
        expect(usableFavor(state, 'p1')).toBe(4)
        expectFavorConserved(state, () => {
            expect(gainFavorFromBank(state, 'p1', Suit.Order, 5)).toBe(3)
            giveFavor(state, 'p1', 'p2', 2)
            expect(takeFavorFromPlayer(state, 'p1', 'p2', 9)).toBe(3)
        })
        expect(state.getPlayerState('p1').favor).toBe(8)
        expect(state.getPlayerState('p2').favor).toBe(0)
        expect(state.favorBank[Suit.Order]).toBe(0)
    })

    it('spending more than a player can use is an invariant failure, not a negative board', () => {
        const state = two()
        expect(() => spendFavor(state, 'p1', 5)).toThrow(/cannot spend 5 favor with 4 to use/)
        expect(() => spendFavor(state, 'p1', -1)).toThrow(/cannot spend -1 favor/)
        expect(state.getPlayerState('p1').favor).toBe(4)
    })

    it('what another player removes is capped by the board', () => {
        const state = two()
        expect(removeFavorFromBoard(state, 'p2', 3)).toBe(1)
        expect(state.getPlayerState('p2').favor).toBe(0)
    })

    it('a holder whose favor lives in a bank spends the board first, then the bank', () => {
        const state = two({ advisers: [KINSHIP] })
        expect(usableFavor(state, 'p1')).toBe(7)
        expectFavorConserved(state, () => giveFavor(state, 'p1', 'p2', 5))
        expect(state.getPlayerState('p1').favor).toBe(0)
        expect(state.favorBank[Suit.Nomad]).toBe(2)
        expect(state.getPlayerState('p2').favor).toBe(6)
    })

    it('settling moves the board to the bank for such a holder and is a no-op for anyone else', () => {
        const state = two({ advisers: [KINSHIP] })
        expectFavorConserved(state, () => {
            settleBoardFavor(state, 'p1')
            settleBoardFavor(state, 'p2')
        })
        expect(state.getPlayerState('p1').favor).toBe(0)
        expect(state.favorBank[Suit.Nomad]).toBe(7)
        expect(state.getPlayerState('p2').favor).toBe(1)
    })
})
