import * as Type from 'typebox'
import { President, sameOwner, type Company, type FinancialState } from '../finance/finance.js'

export const CompanyChanges = Type.Object(
    {
        presidents: Type.Array(
            Type.Object(
                {
                    companyId: Type.String(),
                    previous: Type.Optional(President),
                    next: Type.Optional(President)
                },
                { additionalProperties: false }
            )
        ),
        closedCompanyIds: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type CompanyChanges = Type.Static<typeof CompanyChanges>

export class CompanyChangeRecorder {
    private readonly before: Map<string, Pick<Company, 'president' | 'closed'>>
    constructor(state: Pick<FinancialState, 'companies'>) {
        this.before = new Map(
            state.companies.map((company) => [
                company.id,
                {
                    president: company.president ? { ...company.president } : undefined,
                    closed: company.closed
                }
            ])
        )
    }
    changes(state: Pick<FinancialState, 'companies'>): CompanyChanges {
        const changes: CompanyChanges = { presidents: [], closedCompanyIds: [] }
        for (const company of state.companies) {
            const before = this.before.get(company.id)
            if (company.closed && !before?.closed) changes.closedCompanyIds.push(company.id)
            if (company.closed) continue
            const previous = before?.president
            const next = company.president ? { ...company.president } : undefined
            if (previous && next ? !sameOwner(previous, next) : previous !== next)
                changes.presidents.push({ companyId: company.id, previous, next })
        }
        return changes
    }
}
