import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1856 } from '@tabletop/1856'

// Initials as the charters print them (Public Companies), and short names for the narrow card.
export const CompanyNames1856 = companyNameVariants(Names1856, {
    BBG: { initials: 'BBG', short: 'Buffalo, Brantford & Goderich' },
    CA: { initials: 'CA', short: 'Canada Air Line' },
    CPR: { initials: 'CPR', short: 'Canadian Pacific' },
    CV: { initials: 'CV', short: 'Credit Valley' },
    GT: { initials: 'GT', short: 'Grand Trunk' },
    GW: { initials: 'GW', short: 'Great Western' },
    LPS: { initials: 'LPS', short: 'London & Port Sarnia' },
    TGB: { initials: 'TGB', short: 'Toronto, Grey & Bruce' },
    THB: { initials: 'THB', short: 'Toronto, Hamilton & Buffalo' },
    WR: { initials: 'WR', short: 'Welland' },
    WGB: { initials: 'WGB', short: 'Wellington, Grey & Bruce' },
    CGR: { initials: 'CGR', short: 'Canadian Government' },
    FT: { initials: 'FT', short: 'Flos Tramway' },
    WSRC: { initials: 'W&S', short: 'Waterloo & Saugeen' },
    TCC: { initials: 'TCC', short: 'Canada Company' },
    GLSC: { initials: 'GLS', short: 'Great Lakes Shipping' },
    NFSBC: { initials: 'NFB', short: 'Niagara Falls Bridge' },
    SCFTC: { initials: 'SCT', short: 'St. Clair Tunnel' }
})
