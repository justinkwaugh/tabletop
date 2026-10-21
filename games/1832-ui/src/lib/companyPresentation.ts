import { companyNameVariants } from '@tabletop/18xx-ui'
import { EighteenThirtyTwoNames } from '@tabletop/1832'

// Abbreviations follow the rulebook's company list (§16.3).
export const EighteenThirtyTwoCompanyNames = companyNameVariants(EighteenThirtyTwoNames, {
    ACL: { initials: 'ACL' },
    AWP: { initials: 'A&WP' },
    CG: { initials: 'CoG' },
    FEC: { initials: 'FEC' },
    GRR: { initials: 'GRR' },
    GMO: { initials: 'GM&O' },
    LN: { initials: 'L&N' },
    NW: { initials: 'N&W' },
    SAL: { initials: 'SAL' },
    SOU: { initials: 'Sou' },
    AMTK: { initials: 'AMTK' },
    BNSF: { initials: 'BNSF', short: 'BNSF' },
    IC: { initials: 'IC' },
    CSX: { initials: 'CSX', short: 'CSX' },
    NS: { initials: 'NS' },
    P1: { initials: 'P1' },
    P2: { initials: 'P2' },
    P3: { initials: 'P3' },
    P4: { initials: 'P4' },
    P5: { initials: 'P5' },
    P7: { initials: 'P7' }
})
