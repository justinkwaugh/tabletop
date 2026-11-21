import { describe, expect, it } from 'vitest'
import { getCompany, presidentCertificate } from '@tabletop/18xx'
import { auctionDecision, canBid, lotChoices, priorityAfterAuction } from './auction.js'
import { openedWith, playerCash, seated, setCash } from '../test/positions.js'
import { edit } from '../test/kit.js'

describe('the initial auction', () => {
    it('gives the right to choose to the first to pass when nobody bids (AU-3)', () => {
        const game = seated(3)
        game.act('PassForChoice', {}, 'p1')
        game.act('PassForChoice', {}, 'p2')
        game.act('PassForChoice', {}, 'p3')
        expect(auctionDecision(game.state)).toEqual({ kind: 'choose', playerId: 'p1', bid: 0 })
        game.act('ChooseCertificate', { lotId: 'RPSC' }, 'p1')
        expect(playerCash(game.state, 'p1')).toBe(670 - 130)
        // The next auction opens with the player after the winner (AU-5).
        expect(game.state.choiceAuction?.starterId).toBe('p2')
    })

    it('charges the winner the bid and the certificate, a director’s share at twice its par', () => {
        const game = seated(3)
        game.act('BidForChoice', { amount: 5 }, 'p1')
        game.act('BidForChoice', { amount: 20 }, 'p2')
        game.act('PassForChoice', {}, 'p3')
        game.act('PassForChoice', {}, 'p1')
        expect(lotChoices(game.state, 'p2').find((lot) => lot.lotId === 'IOW')?.parPrices).toEqual([
            74, 82, 90, 100
        ])
        game.act('ChooseCertificate', { lotId: 'IOW', parPrice: 90 }, 'p2')
        expect(playerCash(game.state, 'p2')).toBe(670 - 20 - 180)
        expect(presidentCertificate(game.state, 'IOW')?.owner).toEqual({
            kind: 'player',
            playerId: 'p2'
        })
        expect(getCompany(game.state, 'IOW').parPrice).toBe(90)
        expect(game.state.choiceAuction?.starterId).toBe('p3')
    })

    it('limits a bid to what leaves the cheapest certificate affordable (AU-4)', () => {
        const game = seated(3)
        edit(game, (state) => setCash(state, 'p1', 100))
        // The Brading Harbour Company, at £30, is the cheapest certificate on offer.
        expect(canBid(game.state, 'p1', 70)).toBe(true)
        expect(canBid(game.state, 'p1', 75)).toBe(false)
    })

    it('sells a player who cannot afford any certificate the cheapest for all they have', () => {
        const game = seated(3)
        edit(game, (state) => setCash(state, 'p1', 20))
        game.act('PassForChoice', {}, 'p1')
        game.act('PassForChoice', {}, 'p2')
        game.act('PassForChoice', {}, 'p3')
        expect(auctionDecision(game.state)).toEqual({ kind: 'choose', playerId: 'p1', bid: 0 })
        expect(lotChoices(game.state, 'p1')).toEqual([{ lotId: 'BHC', parPrices: [] }])
        game.act('ChooseCertificate', { lotId: 'BHC' }, 'p1')
        expect(playerCash(game.state, 'p1')).toBe(0)
    })

    it('gives priority to the richest player once all six are sold (AU-6)', () => {
        const game = openedWith(seated(3))
        expect(game.state.machineState).toBe('StockRound')
        // p1 paid £30 + £130, p2 £50 + £148, p3 £90 + £148.
        expect(game.state.activePlayerIds).toEqual(['p1'])
        expect(game.state.turnManager.turnOrder).toEqual(['p1', 'p2', 'p3'])
    })

    it('breaks a tie for the most money by the least face value of privates', () => {
        const game = openedWith(seated(2), [
            { lotId: 'BHC' },
            { lotId: 'YHC' },
            { lotId: 'CMH' },
            { lotId: 'RPSC' },
            { lotId: 'CN', parPrice: 74 },
            { lotId: 'IOW', parPrice: 74 }
        ])
        // p1: BHC 30, CMH 90, CN 148 = 268; p2: YHC 50, RPSC 130, IOW 148 = 328.
        expect(playerCash(game.state, 'p1')).toBe(1000 - 268)
        expect(game.state.activePlayerIds).toEqual(['p1'])
    })

    it('compares only the tied players’ privates (AU-6, OQ-14)', () => {
        const game = openedWith(seated(3))
        // p1 holds £160 of privates, p2 £50, p3 £90; p2 is not among the richest.
        edit(game, (state) => {
            setCash(state, 'p1', 400)
            setCash(state, 'p2', 300)
            setCash(state, 'p3', 400)
        })
        expect(priorityAfterAuction(game.state)).toBe('p3')
    })

    it('gives a tie among players without privates to the first of them in turn order', () => {
        const game = openedWith(seated(3))
        edit(game, (state) => {
            for (const certificate of state.certificates)
                if (certificate.kind === 'private' && certificate.owner.kind === 'player')
                    certificate.owner = { kind: 'bank' }
            setCash(state, 'p1', 300)
            setCash(state, 'p2', 400)
            setCash(state, 'p3', 400)
        })
        expect(priorityAfterAuction(game.state)).toBe('p2')
    })
})
