import type { CompanyNameVariants } from '@tabletop/18xx-ui'
import { EighteenSeventeenCorporations, EighteenSeventeenPrivates } from '@tabletop/1817'

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
    MAJM: 'MajM'
}

export const EighteenSeventeenCompanyNames: Readonly<Record<string, CompanyNameVariants>> =
    Object.fromEntries([
        ...EighteenSeventeenCorporations.map((company) => [
            company.id,
            {
                short: company.name.replace(/ (Railway|Railroad)$/, ''),
                initials: company.abbreviation
            }
        ]),
        ...EighteenSeventeenPrivates.map((company) => [
            company.id,
            { short: company.name, initials: PrivateInitials[company.id] ?? company.id }
        ])
    ])
