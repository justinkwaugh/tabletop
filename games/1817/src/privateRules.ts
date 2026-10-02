import type { PrivateRules } from '@tabletop/18xx'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
export const EighteenSeventeenPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, id) => EighteenSeventeenPrivateCatalog.definition(id).description ?? ''
}
