import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1882 } from '@tabletop/1882'

// Initials as the rulebook prints them (§7.1, §10.4), and short names for the narrow card.
export const CompanyNames1882 = companyNameVariants(Names1882, {
    CN: { initials: 'CN', short: 'Canadian National' },
    CNoR: { initials: 'CNoR', short: 'Canadian Northern' },
    CPR: { initials: 'CPR', short: 'Canadian Pacific' },
    GTP: { initials: 'GTP', short: 'Grand Trunk Pacific' },
    HBR: { initials: 'HBR', short: 'Hudson Bay Railway' },
    QL: { initials: 'QL', short: 'Qu’Appelle & Long Lake' },
    SCR: { initials: 'SCR', short: 'Saskatchewan Central' },
    HB: { initials: 'HB', short: 'Hudson Bay Co.' },
    SC: { initials: 'SC', short: 'Sask. Central Co.' },
    NWR: { initials: 'NWR', short: 'North-West Rebellion' },
    TB: { initials: 'TB', short: 'Trestle Bridge' },
    CP: { initials: 'CP', short: 'Canadian Pacific Co.' }
})
