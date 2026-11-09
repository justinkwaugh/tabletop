import { companyNameVariants } from '@tabletop/18xx-ui'
import { Companies1862, company1862 } from '@tabletop/1862'

// Short names drop "Railway" as the family does; these are the names it would shorten badly.
const ShortNames: Readonly<Record<string, string>> = {
    FDR: 'Felixstowe Dock',
    NGC: 'Newmarket & Chesterford',
    NS: 'Norfolk & Suffolk Joint',
    SVR: 'Stour Valley',
    WSTI: 'Wisbech & St Ives'
}

export const CompanyNames1862 = companyNameVariants(
    { company: (companyId) => company1862(companyId).name },
    Object.fromEntries(
        Companies1862.map((company) => [
            company.id,
            { initials: company.initials, short: ShortNames[company.id] }
        ])
    )
)
