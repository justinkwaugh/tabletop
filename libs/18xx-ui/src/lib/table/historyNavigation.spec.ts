import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { FinishStockTurn, FinishOperatingTurn, SetStockInstruction } from '@tabletop/18xx'
import { isHistoryBookkeeping } from './historyNavigation.js'

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
        instruction: { kind: 'pass' }
    }
    expect(isHistoryBookkeeping(instruction)).toBe(true)
})
