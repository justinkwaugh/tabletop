import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    TestCompanyId,
    TestPlayerId,
    minimalPlayState,
    minimalStockRules
} from '@tabletop/18xx/testing'
import {
    isSetStockInstruction,
    type StandingStockInstruction,
    type StockRules
} from '@tabletop/18xx'
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
    instructions?: StandingStockInstruction[],
    extraIpoShares = 0,
    exemption?: number,
    cash = 100,
    extraMarketShares = 0
): StockInstructionSession['state'] {
    const state = minimalPlayState()
    const extra = [
        ...Array.from({ length: extraIpoShares }, (_, index) => ({
            ...share,
            id: `R-extra-${index}`,
            companyId: TestCompanyId,
            president: false,
            poolId: 'ipo'
        })),
        ...Array.from({ length: extraMarketShares }, (_, index) => ({
            ...share,
            id: `R-market-${index}`,
            companyId: TestCompanyId,
            president: false,
            poolId: 'market'
        }))
    ]
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
            { id: 'market', name: 'Market', owner: bank },
            { id: 'reserved', name: 'Reserved', owner: bank }
        ],
        cash: [...state.cash, { owner: { kind: 'player', playerId: TestPlayerId }, amount: cash }],
        certificates: [
            { ...share, id: 'R-1', companyId: TestCompanyId, president: false, poolId: 'ipo' },
            { ...share, id: 'R-P', companyId: TestCompanyId, president: true, poolId: 'market' },
            { ...share, id: 'R-2', companyId: TestCompanyId, president: false, poolId: 'reserved' },
            { ...share, id: 'S-1', companyId: 'S', president: false, poolId: 'ipo' },
            ...extra
        ],
        ownershipLimitExemptions: exemption
            ? [
                  {
                      companyId: TestCompanyId,
                      owner: { kind: 'player', playerId: TestPlayerId },
                      maximumShares: exemption
                  }
              ]
            : [],
        stockRound: { ...state.stockRound, ...(instructions ? { instructions } : {}) }
    }
}

const purchaseTerms: StockRules['purchaseTerms'] = (_state, certificate) =>
    certificate.poolId === 'reserved'
        ? 'Reserved shares are not for sale'
        : { price: certificate.poolId === 'market' ? 5 : 10, recipient: bank, payers: [] }

function harness(
    valid: string[] = ['SetStockInstruction'],
    availability = {},
    instructions?: StandingStockInstruction[],
    extraIpoShares = 0,
    exemption?: number,
    cash?: number,
    extraMarketShares = 0
) {
    const session = testSession(
        instructionState(instructions, extraIpoShares, exemption, cash, extraMarketShares),
        {
            stockRules: { ...minimalStockRules, purchaseTerms }
        },
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
            until: { kind: 'shares', count: 1 },
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
            until: { kind: 'shares', count: 1 },
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

    it('offers started companies with the pools the title lets the player buy from', () => {
        const { module } = harness()
        expect(
            module.buyChoices.map((choice) => [
                choice.company.id,
                choice.pools.map((pool) => pool.id)
            ])
        ).toEqual([[TestCompanyId, ['ipo']]])
    })

    it('exposes my standing instruction and the reason it would stop', () => {
        const { module } = harness(['SetStockInstruction'], {}, [standingPass])
        expect(module.mine).toEqual(standingPass)
        expect(module.warning).toEqual({ code: 'company-started', companyId: TestCompanyId })
        expect(harness().module.mine).toBeUndefined()
        expect(harness().module.warning).toBeUndefined()
    })
})

describe('share goal range', () => {
    it('spans one more than held up to the smaller of the ownership ceiling and reachable shares', () => {
        const range = (extra: number, exemption?: number, cash?: number) => {
            const { module } = harness(
                ['SetStockInstruction'],
                {},
                undefined,
                extra,
                exemption,
                cash
            )
            return module.shareGoalRange(module.buyChoices[0], 'ipo')
        }
        expect(range(0)).toEqual({ min: 1, max: 1 })
        expect(range(8)).toEqual({ min: 1, max: 6 })
        expect(range(8, 8)).toEqual({ min: 1, max: 6 })
        expect(range(8, 8, 25)).toEqual({ min: 1, max: 2 })
        expect(range(8, 8, 5)).toBeUndefined()
    })

    it('spends only on the preferred pool while it holds shares, otherwise on the cheapest fallback', () => {
        const reach = (preferred: string) => {
            const { module } = harness(['SetStockInstruction'], {}, undefined, 8, 8, 25, 3)
            return module.shareGoalRange(module.buyChoices[0], preferred)
        }
        expect(reach('ipo')).toEqual({ min: 1, max: 2 })
        expect(reach('market')).toEqual({ min: 1, max: 3 })
    })

    it('refuses a share goal outside the reachable range', async () => {
        const { module } = harness()
        await expect(
            module.declareBuy({
                companyId: TestCompanyId,
                preferredPoolId: 'ipo',
                until: { kind: 'shares', count: 4 },
                thenPass: false
            })
        ).rejects.toThrow('reach')
    })
})

describe('last stop', () => {
    const action = (overrides: Record<string, unknown>) => ({
        id: String(overrides.id ?? Math.random()),
        gameId: 'game',
        source: ActionSource.User,
        playerId: TestPlayerId,
        ...overrides
    })
    const declaredBuy = action({
        type: 'SetStockInstruction',
        outOfTurn: true,
        instruction: {
            kind: 'buy',
            companyId: TestCompanyId,
            preferredPoolId: 'ipo',
            until: { kind: 'floated' },
            thenPass: true
        }
    })
    const convertedToPass = action({
        type: 'StopStockInstruction',
        source: ActionSource.System,
        reason: { code: 'goal-met', companyId: TestCompanyId },
        replacement: { kind: 'pass' }
    })
    const stopped = action({
        type: 'StopStockInstruction',
        source: ActionSource.System,
        reason: { code: 'shares-sold', companyId: TestCompanyId }
    })

    it('reports why my instruction stopped and which kind it was', () => {
        const { module } = harness(['SetStockInstruction'], {
            recordedActions: [declaredBuy, stopped]
        })
        expect(module.lastStop).toEqual({
            kind: 'buy',
            reason: { code: 'shares-sold', companyId: TestCompanyId }
        })
        const { module: converted } = harness(['SetStockInstruction'], {
            recordedActions: [declaredBuy, convertedToPass, stopped]
        })
        expect(converted.lastStop).toEqual({
            kind: 'pass',
            reason: { code: 'shares-sold', companyId: TestCompanyId }
        })
    })

    it('forgets the stop once I declare again, clear, or the round ends', () => {
        const cleared = action({ type: 'SetStockInstruction', outOfTurn: true })
        expect(
            harness(['SetStockInstruction'], { recordedActions: [declaredBuy, stopped, cleared] })
                .module.lastStop
        ).toBeUndefined()
        const ended = action({
            type: 'CompleteStockRound',
            source: ActionSource.System,
            playerId: undefined
        })
        expect(
            harness(['SetStockInstruction'], { recordedActions: [declaredBuy, stopped, ended] })
                .module.lastStop
        ).toBeUndefined()
        expect(
            harness(['SetStockInstruction'], { recordedActions: [declaredBuy, convertedToPass] }, [
                standingPass
            ]).module.lastStop
        ).toBeUndefined()
    })
})

describe('floated companies', () => {
    it('drops a floated company with no reachable share goal', () => {
        const { module } = harness()
        module['session'].state.companies[0].floated = true
        expect(module.buyChoices.map((choice) => choice.company.id)).toEqual([TestCompanyId])
        const { module: exhausted } = harness(['SetStockInstruction'], {}, undefined, 0, 0)
        exhausted['session'].state.companies[0].floated = true
        exhausted['session'].state.certificates = exhausted['session'].state.certificates.filter(
            (certificate) => certificate.id !== 'R-1'
        )
        expect(exhausted.buyChoices).toEqual([])
    })
})

describe('hotseat play', () => {
    it('hides the declaration in hotseat play unless viewing as another player', () => {
        expect(harness(['SetStockInstruction'], { hotseatPlay: true }).module.available).toBe(false)
        expect(
            harness(['SetStockInstruction'], { hotseatPlay: true, viewingAsNonActivePlayer: true })
                .module.available
        ).toBe(true)
        expect(harness(['SetStockInstruction']).module.available).toBe(true)
    })
})
