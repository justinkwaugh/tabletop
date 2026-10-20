import { privateOwningCompany, type PrivatePowerRules, type PrivateRules } from '@tabletop/18xx'
import { CompanyDescriptions1846 } from './companyDescriptions.js'

/** Privates close as phase III begins; the Mail Contract survives in a railroad's hands. */
export const PrivateRules1846: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects(state) {
        if (state.phaseId !== 'III') return []
        return state.companies.flatMap((company) =>
            company.kind === 'private' &&
            !company.closed &&
            !(company.id === 'MAIL' && privateOwningCompany(state, company.id))
                ? [{ kind: 'close' as const, privateCompanyId: company.id }]
                : []
        )
    },
    operationEffects: () => [],
    description: (_state, id) => CompanyDescriptions1846[id] ?? ''
}

/** 1846's private powers are title actions, not the family's tile, train and marker powers. */
export const PrivatePowerRules1846: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany: () => undefined
}
