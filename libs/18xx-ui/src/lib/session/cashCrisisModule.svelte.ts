import { assert, assertExists } from '@tabletop/common'
import {
    GoBankrupt,
    SellSharesToPay,
    crisisSales,
    currentDebt,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type ShareSale
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type CashCrisisSession = ModuleSession<
    EighteenXXState,
    Pick<EighteenXXTitleRules, 'cashCrisisRules'>
>

export class CashCrisisModule {
    /** Bankruptcy is confirmed in a second step; Back or Undo withdraws it. */
    readonly bankruptcy = singleChoice<true>()
    constructor(private readonly session: CashCrisisSession) {}

    debt = $derived.by(() => currentDebt(this.session.state))
    sales = $derived.by(() => {
        const rules = this.session.rules.cashCrisisRules
        const debt = this.debt
        return rules && debt ? crisisSales(this.session.state, rules, debt.playerId) : []
    })
    canAct = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('GoBankrupt')
    )
    confirming = $derived.by(
        () => this.session.selectionsVisible && !!this.bankruptcy.value('choice')
    )

    async sell(sale: ShareSale) {
        const option = this.sales.find(
            (option) =>
                option.sale.companyId === sale.companyId && option.sale.shares === sale.shares
        )
        assert(this.canAct && option, 'This sale cannot raise cash now')
        await this.session.applyAction(
            this.session.createPlayerAction(SellSharesToPay, {
                sale,
                expectedProceeds: option.proceeds
            })
        )
    }
    chooseBankruptcy() {
        assert(this.canAct, 'Bankruptcy is not available now')
        this.bankruptcy.choose('choice', true)
    }
    async confirmBankruptcy() {
        assertExists(this.debt, 'Bankruptcy settles a cash crisis')
        assert(this.canAct && this.confirming, 'Choose bankruptcy before confirming it')
        this.bankruptcy.clear()
        await this.session.applyAction(this.session.createPlayerAction(GoBankrupt, {}))
    }
}
