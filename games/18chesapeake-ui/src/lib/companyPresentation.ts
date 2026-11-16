import { companyNameVariants } from '@tabletop/18xx-ui'
import { NamesChesapeake } from '@tabletop/18chesapeake'

// Initials as the rulebook prints them (§7.1, §10.4), and short names for the narrow card.
export const CompanyNamesChesapeake = companyNameVariants(NamesChesapeake, {
    PRR: { initials: 'PRR', short: 'Pennsylvania' },
    PLE: { initials: 'P&LE', short: 'Pittsburgh & Lake Erie' },
    SRR: { initials: 'SRR', short: 'Strasburg' },
    BO: { initials: 'B&O', short: 'Baltimore & Ohio' },
    CO: { initials: 'C&O', short: 'Chesapeake & Ohio' },
    LV: { initials: 'LV', short: 'Lehigh Valley' },
    CA: { initials: 'C&A', short: 'Camden & Amboy' },
    NW: { initials: 'N&W', short: 'Norfolk & Western' },
    DR: { initials: 'D&R', short: 'Delaware & Raritan' },
    CP: { initials: 'C-P', short: 'Columbia – Philadelphia' },
    BS: { initials: 'B&S', short: 'Baltimore & Susquehanna' },
    COC: { initials: 'C&OC', short: 'Chesapeake & Ohio Canal' },
    BOP: { initials: 'B&O', short: 'Baltimore & Ohio RR' },
    CV: { initials: 'CV', short: 'Vanderbilt' }
})
