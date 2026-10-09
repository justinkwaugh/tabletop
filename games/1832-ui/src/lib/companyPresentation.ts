import type { CompanyNameVariants } from '@tabletop/18xx-ui'

// Abbreviations follow the rulebook's company list (§16.3).
export const EighteenThirtyTwoCompanyNames: Readonly<Record<string, CompanyNameVariants>> = {
    ACL: { short: 'Coast Line', initials: 'ACL' },
    AWP: { short: 'West Point', initials: 'A&WP' },
    CG: { short: 'Central of Georgia', initials: 'CoG' },
    FEC: { short: 'Florida East Coast', initials: 'FEC' },
    GRR: { short: 'Georgia', initials: 'GRR' },
    GMO: { short: 'Gulf, Mobile & Ohio', initials: 'GM&O' },
    LN: { short: 'Louisville & Nashville', initials: 'L&N' },
    NW: { short: 'Norfolk & Western', initials: 'N&W' },
    SAL: { short: 'Seaboard', initials: 'SAL' },
    SOU: { short: 'Southern', initials: 'Sou' },
    AMTK: { short: 'Amtrak', initials: 'AMTK' },
    BNSF: { short: 'BNSF', initials: 'BNSF' },
    IC: { short: 'Illinois Central', initials: 'IC' },
    CSX: { short: 'CSX', initials: 'CSX' },
    NS: { short: 'Norfolk Southern', initials: 'NS' },
    P1: { short: 'Carolina Stage Coach', initials: 'P1' },
    P2: { short: 'Cotton Warehouse', initials: 'P2' },
    P3: { short: 'Atlantic Shipping', initials: 'P3' },
    P4: { short: 'London Investment', initials: 'P4' },
    P5: { short: 'West Virginia Coal Fields', initials: 'P5' },
    P7: { short: 'Central Rail Road & Canal', initials: 'P7' }
}
