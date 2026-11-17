import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1867 } from '@tabletop/1867'

// Initials as the charters print them (GTG §3.2, §3.3), and short names for the narrow card.
export const CompanyNames1867 = companyNameVariants(Names1867, {
    AE: { initials: 'AE', short: 'Algoma Eastern' },
    BO: { initials: 'BO', short: 'Brockville & Ottawa' },
    CA: { initials: 'CA', short: 'Canada Atlantic' },
    CS: { initials: 'CS', short: 'Canada Southern' },
    CV: { initials: 'CV', short: 'Credit Valley' },
    KP: { initials: 'KP', short: 'Kingston & Pembroke' },
    NO: { initials: 'NO', short: 'New York & Ottawa' },
    OP: { initials: 'OP', short: 'Ottawa & Prescott' },
    PM: { initials: 'PM', short: 'Pere Marquette' },
    TN: { initials: 'TN', short: 'Toronto & Nipissing' },
    BBG: { initials: 'BBG', short: 'Buffalo, Brantford & Goderich' },
    LPS: { initials: 'LPS', short: 'London & Port Stanley' },
    QLS: { initials: 'QLS', short: 'Quebec & Lake St. John' },
    SLA: { initials: 'SLA', short: 'St. Lawrence & Atlantic' },
    TGB: { initials: 'TGB', short: 'Toronto, Grey & Bruce' },
    THB: { initials: 'THB', short: 'Toronto, Hamilton & Buffalo' },
    CNR: { initials: 'CNR', short: 'Canadian Northern' },
    CPR: { initials: 'CPR', short: 'Canadian Pacific' },
    CO: { initials: 'C&O', short: 'Chesapeake & Ohio' },
    GTR: { initials: 'GTR', short: 'Grand Trunk' },
    GWR: { initials: 'GWR', short: 'Great Western' },
    ICR: { initials: 'ICR', short: 'Intercolonial' },
    NTR: { initials: 'NTR', short: 'National Transcontinental' },
    NYC: { initials: 'NYC', short: 'New York Central' },
    CN: { initials: 'CN', short: 'Canadian National' },
    CSL: { initials: 'C&SL' },
    NFB: { initials: 'NFB' },
    MB: { initials: 'MB' },
    QB: { initials: 'QB' },
    SCT: { initials: 'SCT' }
})
