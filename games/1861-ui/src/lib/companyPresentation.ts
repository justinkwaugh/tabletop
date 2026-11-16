import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1861 } from '@tabletop/1861'

// Initials as the charters print them (§7.2, §7.3), and short names for the narrow card.
export const CompanyNames1861 = companyNameVariants(Names1861, {
    N: { initials: 'N', short: 'Nikolaev' },
    'K-B': { initials: 'K-B', short: 'Kiev–Brest' },
    'K-K': { initials: 'K-K', short: 'Kiev–Kursk' },
    'K-R': { initials: 'K-R', short: 'Kharkov–Rostov' },
    'M-K': { initials: 'M-K', short: 'Moscow–Kursk' },
    'M-NN': { initials: 'M-NN', short: 'Moscow–N. Novgorod' },
    'M-V': { initials: 'M-V', short: 'Moscow–Voronezh' },
    'O-K': { initials: 'O-K', short: 'Odessa–Kiev' },
    'R-O': { initials: 'R-O', short: 'Riga–Orel' },
    'SP-W': { initials: 'SP-W', short: 'St. Petersburg–Warsaw' },
    Y: { initials: 'Y', short: 'Yuzovka' },
    E: { initials: 'E', short: 'Ekaterinin' },
    'M-B': { initials: 'M-B', short: 'Moscow–Brest' },
    'S-V': { initials: 'S-V', short: 'Samara–Vyazma' },
    'T-R': { initials: 'T-R', short: 'Tsaritsyn–Riga' },
    V: { initials: 'V', short: 'Vladikavkaz' },
    GRR: { initials: 'GRR', short: 'Grand Russian' },
    MK: { initials: 'MK', short: 'Moscow & Kazan' },
    MKV: { initials: 'MKV', short: 'Moscow, Kiev & Voronezh' },
    MKN: { initials: 'MKN', short: 'Moscow, Kursk & N. Novgorod' },
    MVR: { initials: 'MVR', short: 'Moscow, Vindava & Rybinsk' },
    NW: { initials: 'NW', short: 'North Western' },
    SE: { initials: 'SE', short: 'Southeastern' },
    SW: { initials: 'SW', short: 'Southwestern' },
    RSR: { initials: 'RSR', short: 'State Railway' },
    TSR: { initials: 'TSR' },
    BSS: { initials: 'BSS' },
    MYR: { initials: 'MYR' },
    MRR: { initials: 'MRR' },
    WVR: { initials: 'WVR' }
})
