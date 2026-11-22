import { privateOwningCompany, type PrivateRules } from '@tabletop/18xx'
import { EighteenUSAPrivateCatalog, SubsidyPrivateIds } from './privates.js'

export const EighteenUSAPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    // The Boomtown subsidy is for the company's first operating round only (Subsidy Tiles).
    operationEffects: (state, companyId) =>
        state.companies.some(
            (company) => company.id === SubsidyPrivateIds.boomtown && !company.closed
        ) && privateOwningCompany(state, SubsidyPrivateIds.boomtown) === companyId
            ? [{ kind: 'close', privateCompanyId: SubsidyPrivateIds.boomtown }]
            : [],
    description: (_state, id) => EighteenUSAPrivateCatalog.definition(id).description ?? ''
}
