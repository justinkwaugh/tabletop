import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, getCompany } from '@tabletop/18xx'
import { buy, edit, finishStockRound, opened, sellOut, start } from '../test/kit.js'
import { companyFunding } from './capitalization.js'

const treasury = (state: Parameters<typeof finiteCashOwnedBy>[0], companyId: string) =>
    finiteCashOwnedBy(state, { kind: 'company', companyId })

describe('1856 capitalization (Public Company Starting Treasury)', () => {
    it('pays an escrow company its first five shares and holds the rest in escrow', () => {
        const game = opened(4)
        edit(game, (state) => {
            for (const entry of state.cash) if (entry.owner.kind === 'player') entry.amount = 1000
        })
        start(game, 'GT', 100)
        buy(game, 'GT', 100, 3)
        expect(companyFunding(game.state, 'GT')?.capitalization).toBe('escrow')
        expect(treasury(game.state, 'GT')).toBe(500)
        buy(game, 'GT', 100, 2)
        expect(treasury(game.state, 'GT')).toBe(500)
        expect(companyFunding(game.state, 'GT')?.escrow).toBe(200)
    })

    it('pays an incremental company for every share as it is sold, once the 5s are on sale', () => {
        const game = opened(4)
        edit(game, (state) => sellOut(state, ['2', '3', '4']))
        start(game, 'GT', 90)
        buy(game, 'GT', 90, 4)
        expect(companyFunding(game.state, 'GT')?.capitalization).toBe('incremental')
        expect(treasury(game.state, 'GT')).toBe(540)
    })

    it('pays a fully capitalized company ten times par as its sixth share is sold', () => {
        const game = opened(4)
        edit(game, (state) => {
            sellOut(state, ['2', '3', '4', '5'])
            for (const entry of state.cash) if (entry.owner.kind === 'player') entry.amount = 1000
        })
        start(game, 'GT', 100)
        buy(game, 'GT', 100, 3)
        expect(companyFunding(game.state, 'GT')?.capitalization).toBe('full')
        expect(treasury(game.state, 'GT')).toBe(0)
        buy(game, 'GT', 100, 1)
        expect(treasury(game.state, 'GT')).toBe(1000)
        expect(game.actions.some((action) => action.type === 'CapitalizeCompany')).toBe(true)
        buy(game, 'GT', 100, 1)
        expect(treasury(game.state, 'GT')).toBe(1000)
        finishStockRound(game)
        expect(getCompany(game.state, 'GT').floated).toBe(true)
        expect(treasury(game.state, 'GT')).toBe(1000)
    })
})

describe('1856 shares needed to operate (Initial Shares Needed to Operate)', () => {
    it('operates a company with as many shares sold as the train on sale', () => {
        const game = opened(4)
        start(game, 'GT', 100)
        finishStockRound(game)
        expect(getCompany(game.state, 'GT').floated).toBe(true)
        expect(game.state.trackStep?.companyId).toBe('GT')
    })

    it('leaves out a company short of shares for the train on sale', () => {
        const game = opened(4)
        edit(game, (state) => sellOut(state, ['2']))
        start(game, 'GT', 100)
        finishStockRound(game)
        expect(getCompany(game.state, 'GT').floated).toBe(false)
        expect(game.state.machineState).toBe('StockRound')
        expect(game.state.stockRound.number).toBe(2)
        expect(game.actions.some((action) => action.type === 'StartOperatingTurn')).toBe(false)
    })
})
