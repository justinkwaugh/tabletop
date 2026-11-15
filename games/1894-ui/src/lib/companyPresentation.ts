import { companyNameVariants } from '@tabletop/18xx-ui'
import { EighteenNinetyFourNames } from '@tabletop/1894'

export const EighteenNinetyFourCompanyNames = companyNameVariants(EighteenNinetyFourNames, {
    PLM: { short: 'Paris–Lyon–Méditerranée', initials: 'PLM' },
    CFOR: { short: 'Orléans à Rouen', initials: 'CFOR' },
    Nord: { short: 'Nord', initials: 'Nord' },
    Ouest: { short: 'Ouest', initials: 'Ouest' },
    Est: { short: 'Est', initials: 'Est' },
    AG: { short: 'Anvers à Gand', initials: 'AG' },
    Belge: { short: 'État belge', initials: 'Belge' },
    LF: { short: 'Late French', initials: 'LF' },
    LB: { short: 'Late Belgian', initials: 'LB' },
    LRC: { short: 'Reims à Charleville', initials: 'LRC' },
    AR: { short: 'Antwerpen-Rotterdam', initials: 'AR' },
    GLG: { short: 'Liège-Guillemins', initials: 'GLG' },
    SAC: { short: 'Antwerpen Centraal', initials: 'SAC' },
    SQG: { short: 'Saint-Quentin à Guise', initials: 'LSQG' },
    LS: { short: 'London shipping', initials: 'LS' },
    NMinorS: { short: 'Nord minor shareholding', initials: 'Nord m.' },
    PLMMS: { short: 'PLM major shareholding', initials: 'PLM M.' },
    OMMS: { short: 'Ouest major shareholding', initials: 'Ouest M.' },
    NMS: { short: 'Nord major shareholding', initials: 'Nord M.' },
    CMS: { short: 'CFOR major shareholding', initials: 'CFOR M.' },
    EMS: { short: 'Est major shareholding', initials: 'Est M.' },
    BMS: { short: 'Belge major shareholding', initials: 'Belge M.' }
})
