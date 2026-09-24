import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestPlayerId,
    minimalPlayState,
    minimalStockRules
} from '../testing/index.js'
import type { StockInstructionRules } from './stockInstruction.js'
import { createStandingStockInstruction, stockPositionChange } from './stockInstructionSnapshot.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

const owner = { kind: 'player', playerId: TestPlayerId } as const
const rival = { kind: 'player', playerId: 'blair' } as const

function contested(): StockState {
    const state = minimalPlayState()
    state.players.push({ playerId: rival.playerId, color: state.players[0].color })
    state.companies[0].started = true
    state.companies[0].president = owner
    const share = (id: string, holder: typeof owner | typeof rival) => ({
        id,
        companyId: TestCompanyId,
        kind: 'share' as const,
        shares: 1,
        president: false,
        certificateLimitCount: 1,
        retired: false as const,
        owner: holder
    })
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
        state.certificates.push({ ...state.certificates[3], id: 'r2', owner: rival })
        expect(stockPositionChange(state, standing, minimalStockRules)).toEqual({
            code: 'presidency-threatened',
            companyId: TestCompanyId
        })
        const secure = withHooks({ securePresidency: () => true })
        expect(stockPositionChange(state, standing, secure)).toBeUndefined()
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
        state.certificates.push({ ...state.certificates[3], id: 'r2', owner: rival })
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
