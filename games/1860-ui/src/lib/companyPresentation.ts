import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1860 } from '@tabletop/1860'

// Initials as the charters print them, and short names for the narrow card.
export const CompanyNames1860 = companyNameVariants(Names1860, {
    CN: { initials: 'C&N', short: 'Cowes & Newport' },
    IOW: { initials: 'IOW', short: 'Isle of Wight' },
    IWNJ: { initials: 'IWNJ', short: 'Newport Junction' },
    FYN: { initials: 'FYN', short: 'Freshwater, Yarmouth' },
    NGStL: { initials: 'NGStL', short: 'Godshill & St. Lawrence' },
    BHIR: { initials: 'BHI&R', short: 'Brading Harbour Railway' },
    SC: { initials: 'S&C', short: 'Shanklin & Chale' },
    VYSC: { initials: 'VY&SC', short: 'Ventnor & South Coast' },
    BHC: { initials: 'BHC', short: 'Brading Harbour' },
    YHC: { initials: 'YHC', short: 'Yarmouth Harbour' },
    CMH: { initials: 'CMH', short: 'Cowes Marina' },
    RPSC: { initials: 'RPSC', short: 'Ryde Pier' },
    FFC: { initials: 'FFC', short: 'Fishbourne Ferry' }
})
