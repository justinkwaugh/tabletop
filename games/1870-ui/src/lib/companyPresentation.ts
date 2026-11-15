import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1870 } from '@tabletop/1870'

// Initials as the rulebook lists them (p. 15), its privates by theirs.
export const CompanyNames1870 = companyNameVariants(Names1870, {
    ATSF: { initials: 'ATSF', short: 'Santa Fe' },
    FW: { initials: 'FW', short: 'Fort Worth' },
    GMO: { initials: 'GMO', short: 'Gulf Mobile' },
    IC: { initials: 'IC', short: 'Illinois Central' },
    MP: { initials: 'MP', short: 'Missouri Pacific' },
    MKT: { initials: 'MKT', short: 'Katy' },
    SP: { initials: 'SP', short: 'Southern Pacific' },
    SSW: { initials: 'SSW', short: 'Cotton Belt' },
    SLSF: { initials: 'SLSF', short: 'Frisco' },
    TP: { initials: 'T&P', short: 'Texas & Pacific' },
    GRSC: { initials: 'GRSC' },
    MRBC: { initials: 'MRBC' },
    SCC: { initials: 'SCC' },
    GSC: { initials: 'GSC' },
    FRISCO: { initials: 'SLSF' },
    KATY: { initials: 'MKT' }
})
