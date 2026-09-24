import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { CertificateExchange } from '../finance/certificateExchange.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    copyFinances,
    getCompany,
    openShares,
    type FinancialState,
    type OpenShare
} from '../finance/finance.js'
import { applyPresidencyChange } from '../stock/presidency.js'
import type { SharePurchaseDetails } from '../stock/sharePurchase.js'
import type { FormationState } from './companyState.js'
import type { CompanyRules } from './companyRules.js'

export const CompanyFlotationDetails = Type.Object(
    {
        companyId: Type.String(),
        payments: Type.Array(CashPayment),
        exchanges: Type.Optional(Type.Array(CertificateExchange))
    },
    { additionalProperties: false }
)
export type CompanyFlotationDetails = Type.Static<typeof CompanyFlotationDetails>

export function evaluateCompanyFlotation(
    state: FormationState,
    companyId: string,
    rules: CompanyRules
): CompanyFlotationDetails | undefined {
    const company = getCompany(state, companyId)
    if (!company.started || company.floated || company.closed) return undefined
    const payments = rules.flotationPayments(state, companyId)
    if (!payments) return undefined
    assert(!company.funded || payments.length === 0, 'Initial capital cannot be granted twice')
    return { companyId, payments }
}
export function nextCompanyToFloat(
    state: FormationState,
    rules: CompanyRules
): CompanyFlotationDetails | undefined {
    for (const company of state.companies) {
        const details = evaluateCompanyFlotation(state, company.id, rules)
        if (details) return details
    }
    return undefined
}
export function flotationAfterPurchase(
    state: FormationState,
    purchase: SharePurchaseDetails,
    rules: CompanyRules
): CompanyFlotationDetails | undefined {
    const projected: FormationState = { ...state, ...copyFinances(state) }
    const certificate = projected.certificates.find((item) => item.id === purchase.certificateId)
    assert(certificate && !certificate.retired, 'Missing purchased certificate')
    certificate.owner = purchase.buyer
    delete certificate.poolId
    settleCashPayments(projected, purchase.payments)
    if (purchase.presidency) applyPresidencyChange(projected, purchase.presidency)
    return evaluateCompanyFlotation(projected, purchase.companyId, rules)
}

type ShareholdingState = Pick<FinancialState, 'companies' | 'certificates'>

export function sharesStillToFloat(
    state: ShareholdingState,
    companyId: string,
    soldPercent: number,
    unsold: (certificate: OpenShare) => boolean
): number | undefined {
    const { shareCount } = getCompany(state, companyId)
    if (!shareCount) return undefined
    const unsoldShares = openShares(state, companyId)
        .filter(unsold)
        .reduce((sum, certificate) => sum + certificate.shares, 0)
    return Math.max(0, unsoldShares - Math.floor((shareCount * (100 - soldPercent)) / 100))
}

export function fullCapitalizationPayments(
    state: ShareholdingState,
    companyId: string,
    sharesStillToFloat: number | undefined
): CashPayment[] | undefined {
    if (sharesStillToFloat !== 0) return undefined
    const company = getCompany(state, companyId)
    if (company.funded) return []
    assertExists(company.parPrice, 'Started company requires a par price')
    assertExists(company.shareCount, 'Full capitalization requires a share count')
    return [
        {
            from: { kind: 'bank' },
            to: { kind: 'company', companyId },
            amount: company.parPrice * company.shareCount
        }
    ]
}
