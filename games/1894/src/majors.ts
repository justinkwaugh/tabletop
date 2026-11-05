/**
 * The nine public companies, by their simplified names (§11.3.2.1, §11.3.3.1); the late two open
 * in phase 5+1.
 */
export const EighteenNinetyFourMajors = {
    PLM: { id: 'PLM', name: 'Paris–Lyon–Méditerranée' },
    CFOR: { id: 'CFOR', name: 'Chemin de fer d’Orléans à Rouen' },
    Nord: { id: 'Nord', name: 'Nord' },
    Ouest: { id: 'Ouest', name: 'Ouest' },
    Est: { id: 'Est', name: 'Est' },
    AG: { id: 'AG', name: 'Chemin de fer d’Anvers à Gand' },
    Belge: { id: 'Belge', name: 'État belge' },
    LF: { id: 'LF', name: 'Late French' },
    LB: { id: 'LB', name: 'Late Belgian' }
} as const

/** The French companies one of which is drawn at setup to start floated (§3). */
export const FrenchCompanyIds: readonly string[] = ['PLM', 'CFOR', 'Nord', 'Ouest', 'Est']
/** The Belge always starts floated; it and the drawn French company skip financial operations. */
export const BelgeCompanyId = 'Belge'
/** Late companies, by the country their home is chosen in (§11.3.3). */
export const LateCompanies: Readonly<Record<string, 'France' | 'Belgium'>> = {
    LF: 'France',
    LB: 'Belgium'
}
/** Companies with two home hexes, both placed when they first operate (§7.3.1). */
export const TwoHomeCompanyIds: readonly string[] = ['Ouest', 'Nord', 'CFOR']
