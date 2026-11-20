import { companyNameVariants } from '@tabletop/18xx-ui'
import { NamesMex } from '@tabletop/18mex'

// Initials as the charters print them, and short names for the narrow card.
export const CompanyNamesMex = companyNameVariants(NamesMex, {
    CHI: { initials: 'CHI', short: 'Chihuahua Pacific' },
    NdM: { initials: 'NdM', short: 'National Railways' },
    MC: { initials: 'MC', short: 'Mexican Central' },
    PAC: { initials: 'PAC', short: 'Pacific' },
    TM: { initials: 'TM', short: 'Texas-Mexican' },
    MEX: { initials: 'MEX', short: 'Mexican Railway' },
    SPM: { initials: 'SPM', short: 'Southern Pacific' },
    UdY: { initials: 'UdY', short: 'United Railways of Yucatan' },
    A: { initials: 'A', short: 'Interoceanic' },
    B: { initials: 'B', short: 'Sonora-Baja California' },
    C: { initials: 'C', short: 'Southeastern' },
    MCAR: { initials: 'MCAR', short: 'Mexico City-Acapulco' },
    KCMO: { initials: 'KCM&O', short: 'Kansas City, Mexico & Orient' },
    MIR: { initials: 'MIR', short: 'Mexican International' },
    MNR: { initials: 'MNR', short: 'Mexican National' }
})
