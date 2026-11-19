import { companyNameVariants } from '@tabletop/18xx-ui'
import { NamesRoyalGorge } from '@tabletop/18royalgorge'

// Initials as the charters print them, and short names for the narrow card.
export const CompanyNamesRoyalGorge = companyNameVariants(NamesRoyalGorge, {
    RG: { initials: 'RG', short: 'Rio Grande' },
    SF: { initials: 'SF', short: 'Santa Fe' },
    KP: { initials: 'KP', short: 'Kansas Pacific' },
    SPP: { initials: 'SP&P', short: 'South Park' },
    PAV: { initials: 'P&AV', short: 'Pueblo & Arkansas Valley' },
    NO: { initials: 'D&NO', short: 'Denver & New Orleans' },
    CM: { initials: 'CM', short: 'Colorado Midland' },
    S: { initials: 'S', short: 'Silverton' },
    FCC: { initials: 'F&CC', short: 'Florence & Cripple Creek' },
    CSCC: { initials: 'CS&CC', short: 'Colorado Springs & CC' },
    CS: { initials: 'C&S', short: 'Colorado & Southern' },
    CFI: { initials: 'CF&I', short: 'CF&I Steel' },
    VGC: { initials: 'VGC', short: 'Victor Gold' },
    Y1: { initials: 'Y1', short: 'St. Cloud Hotel' },
    Y2: { initials: 'Y2', short: 'Ghost Town Tour Co.' },
    Y3: { initials: 'Y3', short: 'Coal Creek Mines' },
    Y4: { initials: 'Y4', short: 'William Palmer' },
    Y5: { initials: 'Y5', short: 'State Prison Labor' },
    Y6: { initials: 'Y6', short: 'Local Jeweler' },
    G1: { initials: 'G1', short: 'Doc Holliday' },
    G2: { initials: 'G2', short: '13lb Gold Nugget' },
    G3: { initials: 'G3', short: 'Hanging Bridge Lease' },
    G4: { initials: 'G4', short: 'Florence Oil Fields' },
    G5: { initials: 'G5', short: 'Metals Investor' },
    G6: { initials: 'G6', short: 'Coal Depot' },
    B1: { initials: 'B1', short: 'Silver Mines' },
    B2: { initials: 'B2', short: 'Sulphur Springs' },
    B3: { initials: 'B3', short: 'Steel Depot' },
    B4: { initials: 'B4', short: 'Gold Miner' },
    B5: { initials: 'B5', short: 'Track Engineer' },
    B6: { initials: 'B6', short: 'U.S. Mint Worker' }
})
