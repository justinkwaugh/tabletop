import { describe, expect, it } from 'vitest'
import { cashOf, edit, holderOf, opened, startMajor } from '../test/kit.js'
import { operatingOrder1880 } from './operating.js'
import { bankShares, floatPercent, saleTerms1880 } from './stock.js'

/** Passes until a player who directs nothing is on turn. */
function freshDirector(game: ReturnType<typeof opened>): string {
    while (holderOf(game, 'BCR:president') === game.player) game.act('FinishStockTurn')
    return game.player
}

const sharesOf = (game: ReturnType<typeof opened>, companyId: string) =>
    game.state.certificates.filter((certificate) => certificate.companyId === companyId)

describe('starting a major (§XII)', () => {
    it('takes a 30% director’s certificate in place of a share on sale', () => {
        const game = opened(4, 3)
        const director = game.player
        const before = cashOf(game, director)
        startMajor(game, 'CKR', { presidentShares: 3, permits: 'BC' })
        const president = sharesOf(game, 'CKR').find(
            (certificate) => certificate.id === 'CKR:president'
        )
        expect(president?.kind === 'share' && president.shares).toBe(3)
        expect(sharesOf(game, 'CKR')).toHaveLength(8)
        expect(cashOf(game, director)).toBe(before - 300)
        expect(game.state.permits.CKR).toBe('BC')
    })

    it('offers the permits a certificate’s size allows', () => {
        const game = opened(4, 3)
        expect(() => startMajor(game, 'CKR', { presidentShares: 4, permits: 'AB' })).toThrow()
        startMajor(game, 'CKR', { presidentShares: 4, permits: 'D' })
        expect(game.state.permits.CKR).toBe('D')
    })

    it('puts a share of a player’s first company on their investor', () => {
        const game = opened(4, 3)
        const director = freshDirector(game)
        startMajor(game, 'CKR')
        const investor = ['A1', 'A2', 'A3', 'A4'].find(
            (id) => holderOf(game, `${id}:president`) === director
        )
        const reserved = sharesOf(game, 'CKR').filter(
            (certificate) =>
                certificate.owner.kind === 'company' && certificate.owner.companyId === investor
        )
        expect(reserved).toHaveLength(1)
        // Of the five on sale, the director holds two and the investor one (§VII).
        expect(sharesOf(game, 'CKR').filter((c) => c.poolId === 'bank')).toHaveLength(2)
    })

    it('takes each par slot once, operating by price then slot', () => {
        const game = opened(4, 3)
        startMajor(game, 'CKR', { marketSpaceId: '3:3', slot: 1 })
        game.act('FinishStockTurn')
        expect(() => startMajor(game, 'NXR', { marketSpaceId: '3:3', slot: 1 })).toThrow()
        startMajor(game, 'NXR', { marketSpaceId: '3:3', slot: 0 })
        edit(game, (state) => {
            for (const company of state.companies)
                if (['CKR', 'NXR', 'BCR'].includes(company.id)) company.floated = true
        })
        expect(operatingOrder1880(game.hydrated).filter((id) => !id.startsWith('A'))).toEqual([
            'BCR',
            'NXR',
            'CKR'
        ])
    })
})

describe('floating and capital (§XII)', () => {
    it('floats only as the share round ends, with five times its par', () => {
        const game = opened(4, 3)
        startMajor(game, 'CKR', { marketSpaceId: '3:3' })
        expect(game.state.companies.find((company) => company.id === 'CKR')?.floated).toBe(false)
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
        const ckr = game.state.companies.find((company) => company.id === 'CKR')
        expect(ckr?.floated).toBe(true)
        expect(cashOf(game, 'CKR')).toBe(450)
    })

    it('raises the director’s share to float as the phases go by', () => {
        expect(['A1', 'B1', 'B3', 'C2'].map(floatPercent)).toEqual([20, 30, 40, 60])
    })

    it('counts the investor’s share outside the bank for the second half of capital', () => {
        const game = opened(4, 3)
        freshDirector(game)
        startMajor(game, 'CKR')
        expect(bankShares(game.hydrated, 'CKR')).toBe(7)
    })
})

describe('trading shares (§XII)', () => {
    it('sells no shares in the first share round', () => {
        const game = opened(4, 3)
        expect(game.valid()).not.toContain('SellShares')
    })

    it('stops a player owing money from buying shares', () => {
        const game = opened(4, 3)
        startMajor(game, 'CKR')
        game.act('FinishStockTurn')
        edit(game, (state) => {
            state.playerLoans = [{ playerId: state.activePlayerIds[0], amount: 30 }]
        })
        expect(game.valid()).not.toContain('BuyShares')
        expect(game.valid()).toContain('RepayPlayerLoan')
    })

    it('moves no price for shares sold before the company floats', () => {
        const game = opened(4, 3)
        freshDirector(game)
        startMajor(game, 'CKR')
        edit(game, (state) => {
            state.stockRound.number = 2
        })
        const terms = saleTerms1880(game.hydrated, 'CKR', 1, { kind: 'player', playerId: 'p9' })
        expect(typeof terms !== 'string' && terms.movement).toBe(0)
        edit(game, (state) => {
            const ckr = state.companies.find((company) => company.id === 'CKR')
            if (ckr) ckr.floated = true
        })
        const floated = saleTerms1880(game.hydrated, 'CKR', 1, { kind: 'player', playerId: 'p9' })
        expect(typeof floated !== 'string' && floated.movement).toBe(1)
    })
})
