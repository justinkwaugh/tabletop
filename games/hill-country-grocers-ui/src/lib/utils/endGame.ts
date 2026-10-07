import {
    COMPANIES,
    COMPANIES_EXHAUSTED_TO_END,
    isGrocer,
    type CompanyId,
    type HydratedHcgGameState
} from '@tabletop/hill-country-grocers'

export type EndCondition = {
    label: string
    reached: CompanyId[]
    needed: number
    closest?: { companyId: CompanyId; remaining: string }
}

function closestOf(
    candidates: CompanyId[],
    remaining: (companyId: CompanyId) => number,
    describe: (companyId: CompanyId, count: number) => string
): EndCondition['closest'] {
    const [companyId] = candidates.toSorted((a, b) => remaining(a) - remaining(b))
    return companyId === undefined
        ? undefined
        : { companyId, remaining: describe(companyId, remaining(companyId)) }
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'} left`
}

export function endConditions(state: HydratedHcgGameState): EndCondition[] {
    const soldOut = state.companiesSoldOut()
    const outOfSupply = state.companiesOutOfSupply()
    const companyIds = COMPANIES.map((company) => company.id)
    return [
        {
            label: 'Companies sold out',
            reached: soldOut,
            needed: COMPANIES_EXHAUSTED_TO_END,
            closest: closestOf(
                companyIds.filter((companyId) => !soldOut.includes(companyId)),
                (companyId) => state.unsoldShares(companyId),
                (_, count) => plural(count, 'share')
            )
        },
        {
            label: 'Out of stores or developments',
            reached: outOfSupply,
            needed: COMPANIES_EXHAUSTED_TO_END,
            closest: closestOf(
                companyIds.filter((companyId) => !outOfSupply.includes(companyId)),
                (companyId) => state.supplyRemaining(companyId),
                (companyId, count) => plural(count, isGrocer(companyId) ? 'store' : 'development')
            )
        }
    ]
}
