import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1850 } from '@tabletop/1850'

// Initials as the charters print them (§15.3).
export const CompanyNames1850 = companyNameVariants(Names1850, {
    CBQ: { initials: 'CB&Q', short: 'Burlington' },
    MILW: { initials: 'MILW', short: 'Milwaukee Road' },
    RI: { initials: 'CRI&P', short: 'Rock Island' },
    GN: { initials: 'GN', short: 'Great Northern' },
    MKT: { initials: 'MKT', short: 'Katy' },
    MP: { initials: 'MP', short: 'Missouri Pacific' },
    NP: { initials: 'NP', short: 'Northern Pacific' },
    SOO: { initials: 'SOO', short: 'Soo Line' },
    UP: { initials: 'UP', short: 'Union Pacific' },
    GRSC: { initials: 'GRSC' },
    CM: { initials: 'CM' },
    MRBC: { initials: 'MRBC' },
    GBCC: { initials: 'GBCC' },
    MMC: { initials: 'MMC' },
    WLGC: { initials: 'WLGC' },
    MMR: { initials: 'MMR' }
})
