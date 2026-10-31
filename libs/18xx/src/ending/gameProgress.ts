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
    gameEnding: Type.Optional(GameEnding),
    operatingSet: Type.Optional(
        Type.Object({ number: Type.Integer({ minimum: 1 }), completed: Type.Boolean() })
    )
})
export type ProgressState = Type.Static<typeof ProgressState>
export const ProgressStateValidator = Compile(ProgressState)

export function eighteenXXProgress(
    state: ProgressState,
    phases: PhaseTable,
    money: MoneyFormat
): GameProgress {
    const fraction = phases.share(state.phaseId)
    if (state.gameEnding) {
        const { reason, finalOperatingSet } = state.gameEnding
        const inFinalSet =
            finalOperatingSet === undefined ||
            (state.operatingSet?.number === finalOperatingSet && !state.operatingSet.completed)
        const ending = inFinalSet ? 'Final OR set' : `Ends after OR ${finalOperatingSet}`
        return {
            fraction,
            label: reason === BankBroken ? `${BankBroken} · ${ending}` : ending,
            final: true
        }
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
