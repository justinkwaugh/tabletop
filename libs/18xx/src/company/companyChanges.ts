import * as Type from 'typebox'
import { President, presidentOf, sameOwner, type FinancialState } from '../finance/finance.js'

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
    private readonly before: Map<string, { president?: President; closed?: boolean }>
    constructor(state: Pick<FinancialState, 'companies' | 'certificates'>) {
        this.before = new Map(
            state.companies.map((company) => {
                const president = presidentOf(state, company.id)
                return [
                    company.id,
                    { president: president ? { ...president } : undefined, closed: company.closed }
                ]
            })
        )
    }
    changes(state: Pick<FinancialState, 'companies' | 'certificates'>): CompanyChanges {
        const changes: CompanyChanges = { presidents: [], closedCompanyIds: [] }
        for (const company of state.companies) {
            const before = this.before.get(company.id)
            if (company.closed && !before?.closed) changes.closedCompanyIds.push(company.id)
            if (company.closed) continue
            const previous = before?.president
            const president = presidentOf(state, company.id)
            const next = president ? { ...president } : undefined
            if (previous && next ? !sameOwner(previous, next) : previous !== next)
                changes.presidents.push({ companyId: company.id, previous, next })
        }
        return changes
    }
}
