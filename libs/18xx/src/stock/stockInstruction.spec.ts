import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestPlayerId,
    minimalPlayState,
    minimalStockRules
} from '../testing/index.js'
import type {
    BuyStockInstruction,
    StandingStockInstruction,
    StockInstructionRules
} from './stockInstruction.js'
import { createStandingStockInstruction, stockPositionChange } from './stockInstructionSnapshot.js'
import { evaluateStockInstruction } from './stockInstructionEvaluation.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

const owner = { kind: 'player', playerId: TestPlayerId } as const
const rival = { kind: 'player', playerId: 'blair' } as const

function share(id: string, holder: typeof owner | typeof rival) {
    return { id, companyId: TestCompanyId, kind: 'share' as const, shares: 1, owner: holder }
}

function contested(): StockState {
    const state = minimalPlayState()
    state.players.push({ playerId: rival.playerId, color: state.players[0].color })
    state.companies[0].started = true
    state.companies[0].president = owner
    state.certificates.push(
        share('o1', owner),
        share('o2', owner),
        share('o3', owner),
        share('r1', rival)
    )
    return state
}

function withHooks(instructions: StockInstructionRules): StockRules {
    return { ...minimalStockRules, instructions }
}

describe('standing instruction title hooks', () => {
    it('records a title snapshot beside the family snapshot', () => {
        const state = contested()
        const rules = withHooks({ titleSnapshot: () => ({ loans: 2, phase: '3' }) })
        const standing = createStandingStockInstruction(
            state,
            TestPlayerId,
            { kind: 'pass' },
            rules
        )
        expect(standing.titleSnapshot).toEqual({ loans: 2, phase: '3' })
        expect(standing.snapshot.map((row) => row.companyId)).toEqual([TestCompanyId])
        expect(
            createStandingStockInstruction(state, TestPlayerId, { kind: 'pass' }, minimalStockRules)
        ).not.toHaveProperty('titleSnapshot')
    })

    it('lets a title decide when a presidency is secure', () => {
        const state = contested()
        const standing = createStandingStockInstruction(
            state,
            TestPlayerId,
            { kind: 'pass' },
            minimalStockRules
        )
        state.certificates.push(share('r2', rival))
        expect(stockPositionChange(state, standing, minimalStockRules)).toEqual({
            code: 'presidency-threatened',
            companyId: TestCompanyId
        })
        const secure = withHooks({ securePresidency: () => true })
        expect(stockPositionChange(state, standing, secure)).toBeUndefined()
    })

    it('treats exactly half of a company as a secure presidency', () => {
        const state = contested()
        state.companies[0].shareCount = 6
        const standing = createStandingStockInstruction(
            state,
            TestPlayerId,
            { kind: 'pass' },
            minimalStockRules
        )
        state.certificates.push(share('r2', rival))
        expect(stockPositionChange(state, standing, minimalStockRules)).toBeUndefined()
    })

    function buying(
        state: StockState,
        companyId: string,
        until: BuyStockInstruction['until']
    ): StandingStockInstruction {
        return createStandingStockInstruction(
            state,
            TestPlayerId,
            { kind: 'buy', companyId, preferredPoolId: 'market', until, thenPass: true },
            minimalStockRules
        )
    }
    const threatened = { code: 'presidency-threatened', companyId: TestCompanyId }

    it('keeps buying a threatened target until its goal is met', () => {
        const state = contested()
        const standing = buying(state, TestCompanyId, { kind: 'shares', count: 4 })
        state.certificates.push(share('r2', rival))
        expect(stockPositionChange(state, standing, minimalStockRules)).toBeUndefined()
        state.stockRound.turn.bought = true
        expect(
            evaluateStockInstruction(state, standing, minimalStockRules, ['FinishStockTurn'])
        ).toEqual({ kind: 'pass' })
        state.certificates.push(share('o4', owner))
        expect(stockPositionChange(state, standing, minimalStockRules)).toEqual(threatened)
        expect(
            evaluateStockInstruction(state, standing, minimalStockRules, ['FinishStockTurn'])
        ).toEqual({ kind: 'stop', reason: threatened })
    })

    it('keeps buying a threatened target until it floats', () => {
        const state = contested()
        const standing = buying(state, TestCompanyId, { kind: 'floated' })
        state.certificates.push(share('r2', rival))
        expect(stockPositionChange(state, standing, minimalStockRules)).toBeUndefined()
        state.companies[0].floated = true
        expect(stockPositionChange(state, standing, minimalStockRules)).toEqual(threatened)
    })

    it('stops buying one company when another presidency is threatened', () => {
        const state = contested()
        state.companies.push({ id: 'S', kind: 'major', shareCount: 10 })
        const standing = buying(state, 'S', { kind: 'shares', count: 2 })
        state.certificates.push(share('r2', rival))
        expect(stockPositionChange(state, standing, minimalStockRules)).toEqual(threatened)
    })

    it('lets a title wrap the family cancel rules', () => {
        const state = contested()
        const rules = withHooks({
            titleSnapshot: () => ({ loans: 0 }),
            positionChange: (current, standing, family) =>
                current.companies[0].closed
                    ? { code: 'title', key: 'company-closed', companyId: TestCompanyId }
                    : standing.titleSnapshot?.loans === 0
                      ? family()
                      : { code: 'title', key: 'loans-changed' }
        })
        const standing = createStandingStockInstruction(
            state,
            TestPlayerId,
            { kind: 'pass' },
            rules
        )
        expect(stockPositionChange(state, standing, rules)).toBeUndefined()
        state.certificates.push(share('r2', rival))
        expect(stockPositionChange(state, standing, rules)).toEqual({
            code: 'presidency-threatened',
            companyId: TestCompanyId
        })
        state.companies[0].closed = true
        expect(stockPositionChange(state, standing, rules)).toEqual({
            code: 'title',
            key: 'company-closed',
            companyId: TestCompanyId
        })
    })
})
