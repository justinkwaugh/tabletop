import type { PrivateRules } from '@tabletop/18xx'
import { EighteenThirtyTwoPrivateCatalog } from './privates.js'

export const EighteenThirtyTwoPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    // Every private closes when the first 5-train is bought (§12.4).
    phaseEffects: (state) => EighteenThirtyTwoPrivateCatalog.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => EighteenThirtyTwoPrivateCatalog.definition(id).description ?? ''
}
