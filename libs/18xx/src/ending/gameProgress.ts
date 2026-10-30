import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { GameProgress } from '@tabletop/common'
import { cashOwnedBy, FinanceFields } from '../finance/finance.js'
import type { MoneyFormat } from '../finance/money.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import { BankBroken, GameEnding } from './gameEnding.js'

export const ProgressState = Type.Object({
    phaseId: Type.String(),
    cash: FinanceFields.cash,
    gameEnding: Type.Optional(GameEnding)
})
export type ProgressState = Type.Static<typeof ProgressState>
export const ProgressStateValidator = Compile(ProgressState)

export function eighteenXXProgress(
    state: ProgressState,
    phases: PhaseTable,
    money: MoneyFormat
): GameProgress {
    const fraction = phases.share(state.phaseId)
    if (state.gameEnding)
        return {
            fraction,
            label:
                state.gameEnding.reason === BankBroken
                    ? `${BankBroken} · Final OR set`
                    : 'Final OR set',
            final: true
        }
    const bank = cashOwnedBy(state, { kind: 'bank' })
    return {
        fraction,
        label:
            typeof bank === 'number'
                ? `Phase ${state.phaseId} · Bank ${money(bank)}`
                : `Phase ${state.phaseId}`
    }
}
