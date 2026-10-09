import type { PrivateRules } from '@tabletop/18xx'
import { closesLondonAfterDividend } from './londonInvestment.js'
import { EighteenThirtyTwoPrivateCatalog } from './privates.js'

export const EighteenThirtyTwoPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    // Every private closes when the first 5-train is bought (§12.4).
    phaseEffects: (state) => EighteenThirtyTwoPrivateCatalog.closureEffects(state),
    operationEffects: closesLondonAfterDividend,
    description: (_state, id) => EighteenThirtyTwoPrivateCatalog.definition(id).description ?? ''
}
