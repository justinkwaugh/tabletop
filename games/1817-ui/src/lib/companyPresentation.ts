import { assertExists } from '@tabletop/common'
import { companyNameVariants, type CompanyNaming } from '@tabletop/18xx-ui'
import {
    EighteenSeventeenCorporations,
    EighteenSeventeenNames,
    EighteenSeventeenPrivates,
    VolatilityPrivateIds
} from '@tabletop/1817'

const PrivateInitials: Readonly<Record<string, string>> = {
    MINC: 'MinC',
    OBC: 'OBC',
    MTE: 'ME',
    PSM: 'PSM',
    CM: 'CM',
    MINM: 'MinM',
    TS: 'TS',
    UBC: 'UBC',
    MAIL: 'Mail',
    MAJC: 'MajC',
    MAJM: 'MajM',
    // The Volatility privates are known by their printed numbers.
    ...Object.fromEntries(VolatilityPrivateIds.map((id) => [id, id]))
}

export const EighteenSeventeenCompanyNames = companyNameVariants(
    EighteenSeventeenNames,
    Object.fromEntries([
        ...EighteenSeventeenCorporations.map((company): [string, CompanyNaming] => [
            company.id,
            { initials: company.abbreviation }
        ]),
        ...EighteenSeventeenPrivates.map((company): [string, CompanyNaming] => {
            const initials = PrivateInitials[company.id]
            assertExists(initials, `Private ${company.id} has initials`)
            return [company.id, { initials }]
        })
    ])
)
