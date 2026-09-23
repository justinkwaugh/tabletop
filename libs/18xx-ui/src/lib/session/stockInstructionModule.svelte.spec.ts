import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestPlayerId,
    minimalPlayState,
    minimalStockRules
} from '@tabletop/18xx/testing'
import { isSetStockInstruction, type StandingStockInstruction } from '@tabletop/18xx'
import {
    StockInstructionModule,
    type StockInstructionSession
} from './stockInstructionModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const bank = { kind: 'bank' } as const
const share = {
    kind: 'share',
    shares: 1,
    certificateLimitCount: 1,
    retired: false,
    owner: bank
} as const

function instructionState(
    instructions?: StandingStockInstruction[]
): StockInstructionSession['state'] {
    const state = minimalPlayState()
    return {
        ...state,
        machineState: 'StockRound',
        activePlayerIds: ['blake'],
        companies: [
            { ...state.companies[0], started: true },
            { id: 'S', name: 'Shortline', kind: 'major', shareCount: 10 }
        ],
        certificatePools: [
            { id: 'ipo', name: 'IPO', owner: bank },
            { id: 'market', name: 'Market', owner: bank }
        ],
        certificates: [
            { ...share, id: 'R-1', companyId: TestCompanyId, president: false, poolId: 'ipo' },
            { ...share, id: 'R-P', companyId: TestCompanyId, president: true, poolId: 'market' },
            { ...share, id: 'S-1', companyId: 'S', president: false, poolId: 'ipo' }
        ],
        stockRound: { ...state.stockRound, ...(instructions ? { instructions } : {}) }
    }
}

function harness(
    valid: string[] = ['SetStockInstruction'],
    availability = {},
    instructions?: StandingStockInstruction[]
) {
    const session = testSession(
        instructionState(instructions),
        { stockRules: minimalStockRules },
        valid,
        availability
    )
    return { ...session, module: new StockInstructionModule(session.session) }
}

const standingPass: StandingStockInstruction = {
    playerId: TestPlayerId,
    instruction: { kind: 'pass' },
    snapshot: [
        { companyId: TestCompanyId, started: false, ownerShares: 0, rivalShares: 0, bankShares: 0 }
    ]
}

describe('StockInstructionModule', () => {
    it('can declare while another player is active as long as the action is valid', () => {
        expect(harness().module.canDeclare).toBe(true)
        expect(harness([]).module.canDeclare).toBe(false)
        expect(harness(['SetStockInstruction'], { interactive: false }).module.canDeclare).toBe(
            false
        )
    })

    it('declares a pass out of turn', async () => {
        const { module, applied } = harness()
        await module.declarePass()
        expect(applied).toHaveLength(1)
        const action = applied[0]
        expect(isSetStockInstruction(action) && action.outOfTurn).toBe(true)
        expect(isSetStockInstruction(action) && action.instruction).toEqual({ kind: 'pass' })
    })

    it('declares a purchase goal and clears it again', async () => {
        const { module, applied } = harness(['SetStockInstruction'], {}, [standingPass])
        await module.declareBuy({
            companyId: TestCompanyId,
            preferredPoolId: 'ipo',
            until: { kind: 'shares', count: 2 },
            thenPass: true
        })
        await module.clear()
        expect(applied.map((action) => action.type)).toEqual([
            'SetStockInstruction',
            'SetStockInstruction'
        ])
        const [buy, cleared] = applied
        expect(buy.outOfTurn).toBe(true)
        expect(isSetStockInstruction(buy) && buy.instruction).toEqual({
            kind: 'buy',
            companyId: TestCompanyId,
            preferredPoolId: 'ipo',
            until: { kind: 'shares', count: 2 },
            thenPass: true
        })
        expect(cleared.outOfTurn).toBe(true)
        expect('instruction' in cleared).toBe(false)
    })

    it('refuses to declare or clear when unavailable', async () => {
        await expect(harness([]).module.declarePass()).rejects.toThrow()
        await expect(harness().module.clear()).rejects.toThrow()
        await expect(
            harness().module.declareBuy({
                companyId: TestCompanyId,
                preferredPoolId: 'market',
                until: { kind: 'floated' },
                thenPass: false
            })
        ).rejects.toThrow()
    })

    it('offers started companies with the pools that hold an ordinary share of them', () => {
        const { module } = harness()
        expect(
            module.buyChoices.map((choice) => [
                choice.company.id,
                choice.pools.map((pool) => pool.id)
            ])
        ).toEqual([[TestCompanyId, ['ipo']]])
    })

    it('exposes my standing instruction, everyone’s, and the reason it would stop', () => {
        const { module } = harness(['SetStockInstruction'], {}, [standingPass])
        expect(module.mine).toEqual(standingPass)
        expect(module.all).toEqual([standingPass])
        expect(module.warning).toBe('Railway was started')
        expect(harness().module.mine).toBeUndefined()
        expect(harness().module.warning).toBeUndefined()
    })
})
