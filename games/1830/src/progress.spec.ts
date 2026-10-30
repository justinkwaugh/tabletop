import { expect, it } from 'vitest'
import { BankBroken } from '@tabletop/18xx'
import { startedGameProgress } from '../../../libs/18xx/test/gameProgress.js'
import { Definition } from './definition/gameDefinition.js'

const { startedGame, initialState, progressAt } = startedGameProgress(Definition, 4)

it('starts at the first phase with the bank left after the players’ starting cash', () => {
    expect(startedGame.progress).toEqual({ fraction: 0, label: 'Phase 2 · Bank $9,600' })
})

it('measures progress through the phase table', () => {
    expect(progressAt({ phaseId: '5' })?.fraction).toBe(0.6)
})

const brokenBank = {
    cash: initialState.cash.map((entry) =>
        entry.owner.kind === 'bank' ? { ...entry, amount: 'unlimited' as const } : entry
    ),
    bank: { broken: true }
}

it('reports the broken bank’s last set as final', () => {
    expect(
        progressAt({
            ...brokenBank,
            phaseId: '6',
            gameEnding: { reason: BankBroken, finalOperatingSet: 9 }
        })
    ).toEqual({ fraction: 0.8, label: 'Bank broken · Final OR set', final: true })
})

it('names the bank only when the broken bank scheduled the end', () => {
    expect(
        progressAt({
            ...brokenBank,
            phaseId: 'D',
            gameEnding: { reason: 'Bankruptcy', finalOperatingSet: 9 }
        })
    ).toEqual({ fraction: 1, label: 'Final OR set', final: true })
})
