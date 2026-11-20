import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1880 } from '@tabletop/1880'

// The rulebook's abbreviations (§VIII), and short names for the narrow card; the foreign
// investors go by F and their number.
export const CompanyNames1880 = companyNameVariants(Names1880, {
    JHA: { initials: 'JHA', short: 'Jingha' },
    JHU: { initials: 'JHU', short: 'Jinghu' },
    JGG: { initials: 'JGG', short: 'Jingguang' },
    JLR: { initials: 'JLR', short: 'Jinglan' },
    BZU: { initials: 'BZU', short: 'Binzhou' },
    LHR: { initials: 'LHR', short: 'Longhai' },
    SCR: { initials: 'SCR', short: 'Schichang' },
    CKR: { initials: 'CKR', short: 'Chengkun' },
    BCR: { initials: 'BCR', short: 'Baocheng' },
    NXR: { initials: 'NXR', short: 'Ningxi' },
    HKR: { initials: 'HKR', short: 'Hukun' },
    NJR: { initials: 'NJR', short: 'Nanjiang' },
    QSR: { initials: 'QSR', short: 'Qinshen' },
    WNR: { initials: 'WNR', short: 'Wunan' },
    P0: { initials: 'P0', short: 'Woosong' },
    P1: { initials: 'P1', short: 'Kaiping' },
    P2: { initials: 'P2', short: 'Yanda Ferry' },
    P3: { initials: 'P3', short: 'Taiwan Western' },
    P4: { initials: 'P4', short: 'Rivers Ferry' },
    P5: { initials: 'P5', short: 'Engineer Office' },
    P6: { initials: 'P6', short: 'Qing Government' },
    P7: { initials: 'P7', short: 'Rocket of China' },
    A1: { initials: 'F1', short: 'Russian Investor' },
    A2: { initials: 'F2', short: 'Japanese Investor' },
    A3: { initials: 'F3', short: 'Belgian Investor' },
    A4: { initials: 'F4', short: 'German Investor' },
    A5: { initials: 'F5', short: 'British Investor' },
    A6: { initials: 'F6', short: 'Portuguese Investor' },
    A7: { initials: 'F7', short: 'French Investor' }
})
