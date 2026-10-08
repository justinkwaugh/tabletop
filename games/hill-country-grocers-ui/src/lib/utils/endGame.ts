import {
    COMPANIES_EXHAUSTED_TO_END,
    type CompanyId,
    type HydratedHcgGameState
} from '@tabletop/hill-country-grocers'

export type EndCondition = {
    label: string
    reached: CompanyId[]
    needed: number
}

export function endConditions(state: HydratedHcgGameState): EndCondition[] {
    return [
        {
            label: `${COMPANIES_EXHAUSTED_TO_END} companies sold out`,
            reached: state.companiesSoldOut(),
            needed: COMPANIES_EXHAUSTED_TO_END
        },
        {
            label: `${COMPANIES_EXHAUSTED_TO_END} companies out of supply`,
            reached: state.companiesOutOfSupply(),
            needed: COMPANIES_EXHAUSTED_TO_END
        }
    ]
}
