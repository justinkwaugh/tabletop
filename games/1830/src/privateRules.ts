import type { PrivateRules } from '@tabletop/18xx'
import { EighteenThirtyPrivateCatalog } from './privates.js'
export const EighteenThirtyPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: (state) => EighteenThirtyPrivateCatalog.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => EighteenThirtyPrivateCatalog.definition(id).description ?? ''
}
