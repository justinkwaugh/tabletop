import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, getCompany } from '@tabletop/18xx'
import { buy, edit, finishStockRound, opened, setCash, start, toBuyingTrains } from '../test/kit.js'
import { LoanRules1856 } from './loans.js'
import { EndingRules1856 } from './operating.js'
import { Market1856 } from './stockMarket.js'
import type { State1856 } from './state.js'

const gt = { kind: 'company' as const, companyId: 'GT' }

/** GT started with four shares held by players, its first operating turn under way. */
function operatingGt() {
    const game = opened(4)
    start(game, 'GT', 100)
    buy(game, 'GT', 100, 2)
    finishStockRound(game)
    return game
}

describe('1856 government loans (Receiving a Government Loan)', () => {
    it('lends $100 once an operating round, up to the shares players hold', () => {
        const game = operatingGt()
        expect(game.state.trackStep?.companyId).toBe('GT')
        const before = finiteCashOwnedBy(game.state, gt)
        game.act('TakeLoan', { companyId: 'GT' })
        expect(finiteCashOwnedBy(game.state, gt)).toBe(before + 100)
        expect(getCompany(game.state, 'GT').loans).toBe(1)
        expect(game.valid()).not.toContain('TakeLoan')
        expect(LoanRules1856.capacity(game.hydrated, 'GT')).toBe(4)
    })

    it('pays only $90 for a loan taken after the run, the interest taken at once', () => {
        const game = operatingGt()
        toBuyingTrains(game)
        const before = finiteCashOwnedBy(game.state, gt)
        game.act('TakeLoan', { companyId: 'GT' })
        expect(finiteCashOwnedBy(game.state, gt)).toBe(before + 90)
    })

    it('charges $10 a loan after the run, the president paying what the treasury cannot', () => {
        const game = operatingGt()
        edit(game, (state) => {
            getCompany(state, 'GT').loans = 3
            setCash(state, gt, 15)
        })
        toBuyingTrains(game)
        const interest = game.actions.findLast((action) => action.type === 'PayInterest')
        expect(interest?.metadata).toMatchObject({ interest: 30 })
        // $10 from the treasury in whole $10s, nothing from an empty run, $20 from the president.
        expect(finiteCashOwnedBy(game.state, gt)).toBe(5)
        expect(JSON.stringify(interest?.metadata)).toContain('"amount":20')
    })

    it('takes interest the treasury cannot pay off the run before its president pays', () => {
        const game = operatingGt()
        const state: State1856 = structuredClone(game.state)
        getCompany(state, 'GT').loans = 4
        setCash(state, gt, 10)
        state.routeStep = {
            companyId: 'GT',
            result: { companyId: 'GT', revenue: 20, routes: [] }
        }
        const result = LoanRules1856.interestDefault(state, 'GT', 40)
        expect(result).toMatchObject({ fromRevenue: 20, unpaid: 0 })
    })

    it('redeems loans beyond the shares players hold at the end of the turn', () => {
        const game = operatingGt()
        edit(game, (state) => {
            getCompany(state, 'GT').loans = 6
            setCash(state, gt, 1000)
        })
        toBuyingTrains(game)
        game.act('FinishTrains', { companyId: 'GT' })
        const redeemed = game.actions.findLast((action) => action.type === 'RedeemExcessLoans')
        expect(redeemed?.metadata).toMatchObject({ loans: 2, unpaid: 0 })
        expect(getCompany(game.state, 'GT').loans).toBe(4)
    })
})

describe('1856 loans at the end (Winning)', () => {
    it('values each share $10 less for each loan its company owes', () => {
        const game = operatingGt()
        edit(game, (state) => {
            getCompany(state, 'GT').loans = 2
        })
        const state = game.hydrated
        const price = Market1856.companySpace(state.stockMarket, 'GT').price
        const president = state.certificates.find(
            (certificate) =>
                certificate.companyId === 'GT' &&
                certificate.kind === 'share' &&
                certificate.president
        )
        if (!president) throw new Error('GT has a president')
        const [item] = EndingRules1856.certificateItems(state, president)
        expect(item.value).toBe(2 * (price - 20))
    })
})

describe('1856 when loans are lent (Receiving a Government Loan)', () => {
    it('lends nothing in the redemption step', () => {
        const game = operatingGt()
        edit(game, (state) => {
            getCompany(state, 'GT').loans = 1
            setCash(state, gt, 1000)
        })
        toBuyingTrains(game)
        game.act('FinishTrains', { companyId: 'GT' })
        expect(game.state.machineState).toBe('RepayingLoans')
        expect(game.valid()).not.toContain('TakeLoan')
    })

    it('lends nothing once the first 6-train is bought', () => {
        const game = operatingGt()
        expect(game.valid()).toContain('TakeLoan')
        edit(game, (state) => {
            state.phaseId = '6'
        })
        expect(game.valid()).not.toContain('TakeLoan')
        expect(LoanRules1856.inPlay(game.hydrated)).toBe(false)
    })
})
