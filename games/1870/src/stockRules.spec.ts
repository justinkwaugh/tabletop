import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    cashOwnedBy,
    evaluateShareSale,
    getCompany,
    placeStockMarker,
    sharesOwned,
    type Owner
} from '@tabletop/18xx'
import { operated, prepared, turnFor, type Table } from '../test/kit.js'
import type { State1870 } from './state.js'
import { Market1870 } from './stockMarket.js'
import { StockRules1870, tableCertificateLimit } from './stock.js'

const player = (playerId: string): Owner => ({ kind: 'player', playerId })
const price = (game: Table, companyId: string) =>
    Market1870.companySpace(game.state.stockMarket, companyId).price

function give(state: State1870, companyId: string, playerId: string, shares: number) {
    const certificates = state.certificates.filter(
        (certificate) =>
            certificate.companyId === companyId &&
            certificate.kind === 'share' &&
            certificate.poolId === 'initial-offering'
    )
    for (const certificate of certificates.slice(0, shares)) {
        certificate.owner = { kind: 'player', playerId }
        delete certificate.poolId
    }
}

function setCash(state: State1870, playerId: string, amount: number) {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assertExists(account, 'The player has cash')
    account.amount = amount
}

/** Stock round 2, with p2's IC and p1 holding shares of it. */
function secondRound(prepare: (state: State1870) => void = () => undefined) {
    return prepared((state) => {
        state.stockRound.number = 2
        operated(state, 'IC', 'p2', { shares: 2 })
        give(state, 'IC', 'p1', 3)
        for (const entry of state.players) setCash(state, entry.playerId, 1000)
        turnFor(state, 'p1')
        prepare(state)
    })
}

function sell(game: Table, companyId: string, shares: number) {
    const playerId = game.player
    const request = { playerId, seller: player(playerId), sales: [{ companyId, shares }] }
    const { details, reason } = evaluateShareSale(game.hydrated, request, StockRules1870)
    assertExists(details, reason)
    game.act('SellShares', { ...request, expectedProceeds: details.proceeds })
}

describe('price protection (p. 13)', () => {
    it('holds the price until the president decides, once the seller finishes', () => {
        const game = secondRound()
        sell(game, 'IC', 2)
        expect(price(game, 'IC')).toBe(100)
        game.act('FinishStockTurn')
        expect(game.state.machineState).toBe('ProtectingPrice')
        expect(game.player).toBe('p2')
        expect(game.valid()).toEqual(expect.arrayContaining(['ProtectShares', 'DeclineProtection']))
        expect(game.valid()).not.toContain('FinishStockTurn')
    })

    it('lets the president buy the shares at the sale price, the price unmoved', () => {
        const game = secondRound()
        sell(game, 'IC', 2)
        game.act('FinishStockTurn')
        game.act('ProtectShares', { companyId: 'IC' })
        expect(sharesOwned(game.state, 'IC', player('p2'))).toBe(4)
        expect(cashOwnedBy(game.state, player('p2'))).toBe(800)
        expect(price(game, 'IC')).toBe(100)
        // Play resumes to the left of the protecting president.
        expect(game.state.machineState).toBe('StockRound')
        expect(game.player).toBe('p3')
    })

    it('drops the price when declined, a block stopping on the ledge', () => {
        const game = secondRound()
        sell(game, 'IC', 2)
        game.act('FinishStockTurn')
        game.act('DeclineProtection', { companyId: 'IC' })
        expect(price(game, 'IC')).toBe(82)
        expect(game.state.machineState).toBe('StockRound')
    })

    it('needs the cash to buy every share sold', () => {
        const game = secondRound((state) => setCash(state, 'p2', 150))
        sell(game, 'IC', 2)
        game.act('FinishStockTurn')
        expect(game.state.machineState).toBe('StockRound')
        expect(price(game, 'IC')).toBe(82)
    })

    it('bars a president who sold the company this stock round (p. 13)', () => {
        const game = secondRound((state) => {
            state.stockRound.sales.push({ owner: player('p2'), companyId: 'IC' })
        })
        sell(game, 'IC', 1)
        game.act('FinishStockTurn')
        expect(game.state.machineState).toBe('StockRound')
    })

    it('moves a president’s own sale at once', () => {
        const game = prepared((state) => {
            state.stockRound.number = 2
            operated(state, 'IC', 'p1', { shares: 4 })
            give(state, 'IC', 'p2', 1)
            turnFor(state, 'p1')
        })
        sell(game, 'IC', 1)
        expect(price(game, 'IC')).toBe(90)
    })

    it('lets a sale that passes the presidency fall with no protection (p. 16)', () => {
        const game = prepared((state) => {
            state.stockRound.number = 2
            operated(state, 'IC', 'p1', { shares: 3 })
            give(state, 'IC', 'p2', 2)
            turnFor(state, 'p1')
        })
        sell(game, 'IC', 2)
        expect(getCompany(game.state, 'IC').president).toEqual({ kind: 'player', playerId: 'p2' })
        expect(game.state.priceProtection).toBeUndefined()
        expect(price(game, 'IC')).toBeLessThan(100)
    })

    it('keeps a protected holding above 60%, then makes its holder sell down to 60%', () => {
        const game = prepared((state) => {
            state.stockRound.number = 2
            operated(state, 'IC', 'p2', { shares: 6 })
            give(state, 'IC', 'p1', 2)
            for (const entry of state.players) setCash(state, entry.playerId, 1000)
            turnFor(state, 'p1')
        })
        sell(game, 'IC', 2)
        game.act('FinishStockTurn')
        game.act('ProtectShares', { companyId: 'IC' })
        expect(sharesOwned(game.state, 'IC', player('p2'))).toBe(8)
        while (game.player !== 'p2') game.act('FinishStockTurn')
        const reason = (shares: number) =>
            evaluateShareSale(
                game.hydrated,
                { playerId: 'p2', seller: player('p2'), sales: [{ companyId: 'IC', shares }] },
                StockRules1870
            ).reason
        expect(reason(1)).toBe('Sell down to 60% of this company.')
    })
})

describe('holdings above 60%', () => {
    function holdingAt(price: number) {
        return prepared((state) => {
            state.stockRound.number = 2
            operated(state, 'IC', 'p1', { price: 100, shares: 8 })
            const space = Market1870.spaces.find((entry) => entry.price === price)
            assertExists(space, `No $${price} space`)
            placeStockMarker(state.stockMarket, 'IC', space.id)
            setCash(state, 'p1', 1000)
            turnFor(state, 'p1')
        })
    }
    const openIpoShare = (game: Table) => {
        const share = game.state.certificates.find(
            (certificate) => certificate.companyId === 'IC' && certificate.poolId
        )
        assertExists(share, 'IC has shares on offer')
        return share.id
    }

    it('are kept when the price leaves the free zones, as the designer plays them', () => {
        const game = holdingAt(100)
        expect(game.valid()).toContain('FinishStockTurn')
        game.act('FinishStockTurn')
        expect(sharesOwned(game.state, 'IC', player('p1'))).toBe(8)
    })

    it('may not be added to outside the free zones', () => {
        const game = holdingAt(100)
        expect(() =>
            game.act('BuyShares', {
                buyer: player('p1'),
                certificateId: openIpoShare(game),
                expectedPrice: 100
            })
        ).toThrow()
    })

    it('sell down to 60% the next time their holder sells that company', () => {
        const game = holdingAt(100)
        const reason = (shares: number) =>
            evaluateShareSale(
                game.hydrated,
                { playerId: 'p1', seller: player('p1'), sales: [{ companyId: 'IC', shares }] },
                StockRules1870
            ).reason
        expect(reason(1)).toBe('Sell down to 60% of this company.')
        expect(reason(2)).toBeUndefined()
    })
})

describe('certificate limits (p. 7)', () => {
    it('reads ten companies until one closes', () => {
        const game = secondRound()
        expect(tableCertificateLimit(game.state)).toBe(16)
        const closed = structuredClone(game.state)
        getCompany(closed, 'IC').closed = true
        expect(tableCertificateLimit(closed)).toBe(14)
    })
})

describe('redemption and reissue (pp. 16-17)', () => {
    /** p1's IC, which has operated, with a share in the open market. */
    function companyTurn(prepare: (state: State1870) => void = () => undefined) {
        return prepared((state) => {
            state.stockRound.number = 2
            operated(state, 'IC', 'p1', { shares: 4, cash: 500 })
            give(state, 'IC', 'p2', 3)
            turnFor(state, 'p1')
            prepare(state)
        })
    }
    const toMarket = (state: State1870) => {
        const share = state.certificates.find(
            (certificate) =>
                certificate.companyId === 'IC' && certificate.poolId === 'initial-offering'
        )
        assertExists(share, 'IC has a share on offer')
        share.poolId = 'open-market'
    }

    it('redeems from the market while it has a share, as the turn’s only action', () => {
        const game = companyTurn(toMarket)
        const certificate = game.state.certificates.find(
            (entry) => entry.companyId === 'IC' && entry.poolId === 'open-market'
        )
        assertExists(certificate, 'The market holds a share')
        game.act('RedeemShare', { companyId: 'IC', certificateId: certificate.id })
        expect(cashOwnedBy(game.state, { kind: 'company', companyId: 'IC' })).toBe(400)
        // Nothing else remains for the turn, so it passes on.
        expect(game.player).toBe('p2')
        expect(game.state.redemptions).toEqual({ IC: 1 })
    })

    it('waits until the company has operated', () => {
        const game = companyTurn((state) => {
            toMarket(state)
            getCompany(state, 'IC').operated = false
        })
        expect(game.valid()).not.toContain('RedeemShare')
    })

    it('asks another player, who may refuse', () => {
        const game = companyTurn()
        const certificate = game.state.certificates.find(
            (entry) =>
                entry.companyId === 'IC' &&
                entry.owner.kind === 'player' &&
                entry.owner.playerId === 'p2'
        )
        assertExists(certificate, 'p2 holds a share')
        game.act('RedeemShare', { companyId: 'IC', certificateId: certificate.id })
        expect(game.state.machineState).toBe('ConsentingRedemption')
        expect(game.player).toBe('p2')
        game.act('AnswerRedemption', { accept: false })
        expect(sharesOwned(game.state, 'IC', player('p2'))).toBe(3)
        expect(game.player).toBe('p1')
    })

    it('reissues only with nothing on the initial offering, at the higher par', () => {
        const game = companyTurn((state) => {
            for (const certificate of state.certificates)
                if (certificate.companyId === 'IC' && certificate.poolId === 'initial-offering') {
                    certificate.owner = { kind: 'player', playerId: 'p3' }
                    delete certificate.poolId
                }
            const redeemed = state.certificates.find(
                (certificate) =>
                    certificate.companyId === 'IC' &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === 'p3'
            )
            assertExists(redeemed, 'p3 holds a share')
            redeemed.owner = { kind: 'company', companyId: 'IC' }
            getCompany(state, 'IC').parPrice = 68
        })
        game.act('ReissueShares', { companyId: 'IC' })
        expect(getCompany(game.state, 'IC').parPrice).toBe(76)
        expect(
            game.state.certificates.filter(
                (certificate) =>
                    certificate.companyId === 'IC' && certificate.poolId === 'initial-offering'
            )
        ).toHaveLength(1)
    })
})
