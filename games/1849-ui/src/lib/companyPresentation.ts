import { companyNameVariants } from '@tabletop/18xx-ui'
import { Names1849 } from '@tabletop/1849'

// Initials and nicknames as the charters print them (§7.1, §7.2).
export const CompanyNames1849 = companyNameVariants(Names1849, {
    AFG: { initials: 'AFG', short: 'Garibaldi' },
    ATA: { initials: 'ATA', short: 'Archimede' },
    CTL: { initials: 'CTL', short: 'Lilibeo' },
    IFT: { initials: 'IFT', short: 'Trinacria' },
    RCS: { initials: 'RCS', short: 'Sicula' },
    SFA: { initials: 'SFA', short: 'Akragas' },
    SCE: { initials: 'SCE' },
    SIGI: { initials: 'SIGI' },
    CNM: { initials: 'CNM' },
    SMS: { initials: 'SMS' },
    RSA: { initials: 'RSA' }
})

/** The charter colours (§7.2). */
export const CompanyColors1849: Readonly<Record<string, string>> = {
    AFG: '#d6242c',
    ATA: '#2f8a3e',
    CTL: '#f2b230',
    IFT: '#1b86c8',
    RCS: '#ee7f22',
    SFA: '#e99bbd'
}
