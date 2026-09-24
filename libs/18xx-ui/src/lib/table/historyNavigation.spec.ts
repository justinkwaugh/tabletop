import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { FinishStockTurn, FinishOperatingTurn, SetStockInstruction } from '@tabletop/18xx'
import { isHistoryBookkeeping, shouldContinueHistoryStep } from './historyNavigation.js'

it('skips turn completion while retaining a player pass as a history stop', () => {
    const finish: FinishStockTurn = {
        id: 'finish',
        gameId: 'game',
        playerId: 'alex',
        source: ActionSource.User,
        type: 'FinishStockTurn',
        metadata: { passed: false }
    }
    expect(isHistoryBookkeeping(finish)).toBe(true)
    const pass: FinishStockTurn = { ...finish, metadata: { passed: true } }
    expect(isHistoryBookkeeping(pass)).toBe(false)
    const operating: FinishOperatingTurn = {
        id: 'operating',
        gameId: 'game',
        playerId: 'alex',
        source: ActionSource.User,
        type: 'FinishOperatingTurn',
        companyId: 'G'
    }
    expect(isHistoryBookkeeping(operating)).toBe(true)
    const instruction: SetStockInstruction = {
        id: 'instruction',
        gameId: 'game',
        playerId: 'alex',
        source: ActionSource.User,
        type: 'SetStockInstruction',
        outOfTurn: true,
        supersedable: true,
        instruction: { kind: 'pass' }
    }
    expect(isHistoryBookkeeping(instruction)).toBe(true)
})

it('steps onto automatic passes and purchases like hand-taken ones', () => {
    const automaticPass = {
        id: 'auto-pass',
        gameId: 'g',
        type: 'FinishStockTurn',
        source: ActionSource.System,
        playerId: 'p',
        metadata: { passed: true }
    }
    const automaticBuy = {
        id: 'auto-buy',
        gameId: 'g',
        type: 'BuyShares',
        source: ActionSource.System,
        playerId: 'p',
        buyer: { kind: 'player', playerId: 'p' },
        certificateId: 'c',
        expectedPrice: 10
    }
    const floated = {
        id: 'float',
        gameId: 'g',
        type: 'FloatCompany',
        source: ActionSource.System,
        companyId: 'R'
    }
    expect(shouldContinueHistoryStep(automaticPass)).toBe(false)
    expect(shouldContinueHistoryStep(automaticBuy)).toBe(false)
    expect(shouldContinueHistoryStep(floated)).toBe(true)
})
