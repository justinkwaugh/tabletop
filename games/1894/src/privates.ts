import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import { LondonLocationId, LondonShippingLocationId, LuxembourgLocationId } from './map.js'
import { EighteenNinetyFourPhases } from './trains.js'

/** The French major shareholding private of each French company (§11.2.2.8). */
export const MajorShareholdings: Readonly<Record<string, string>> = {
    PLMMS: 'PLM',
    OMMS: 'Ouest',
    NMS: 'Nord',
    CMS: 'CFOR',
    EMS: 'Est',
    BMS: 'Belge'
}
/**
 * The French company drawn at setup (§3): the one whose major shareholding is in play. It and
 * the Belge start floated and skip financial operations.
 */
export function startingFrenchCompanyId(state: { companies: readonly { id: string }[] }) {
    const id = state.companies
        .map((company) => MajorShareholdings[company.id])
        .find((companyId) => companyId && companyId !== 'Belge')
    return id
}
/** One of Gare de Liège-Guillemins and Station Antwerpen Centraal is removed at setup (§3). */
export const StationPrivateIds: readonly string[] = ['GLG', 'SAC']
export const NordMinorShareholdingId = 'NMinorS'
export const SaintQuentinPrivateId = 'SQG'
export const LondonShippingPrivateId = 'LS'
export const ReimsCharlevillePrivateId = 'LRC'
export const AntwerpRotterdamPrivateId = 'AR'

const frenchMajorShareholding = (id: string, companyId: string, name: string) => ({
    id,
    name: `${name} major shareholding`,
    faceValue: 180,
    revenue: 40,
    sale: 'never' as const,
    description: `Comes with the ${name} president’s certificate; its buyer sets the ${name}’s par at once. Cannot be sold to a company. Closes when the ${companyId} operates.`
})

// §11.2.2: the private companies, in auction order by cost.
export const EighteenNinetyFourPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '6',
        privates: [
            {
                id: 'LRC',
                name: 'Ligne de Reims à Charleville',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: ['I14'], until: 'company-owned' },
                description: `Once per game the owning company may pay ₣60 to lay an extra yellow tile, which it cannot upgrade that round. Blocks ${place('I14')} while player-owned. Closes at phase 6.`
            },
            {
                id: 'AR',
                name: 'Antwerpen-Rotterdamsche Spoorwegmaatschappij',
                faceValue: 25,
                revenue: 5,
                description: 'Earns ₣10 while a company owns it. Closes at phase 6.'
            },
            {
                id: 'GLG',
                name: 'Gare de Liège-Guillemins',
                faceValue: 50,
                revenue: 10,
                blocks: { locationIds: ['H17'], until: 'company-owned' },
                description: `The owning company may lay or upgrade a yellow tile in ${place('H17')} as a track action without a connection, then place its cheapest station there free as its station placement. Blocks ${place('H17')} while player-owned. Closes at phase 6.`
            },
            {
                id: 'SAC',
                name: 'Station Antwerpen Centraal',
                faceValue: 50,
                revenue: 10,
                blocks: { locationIds: ['D17'], until: 'company-owned' },
                description: `The owning company may lay or upgrade a yellow tile in ${place('D17')} as a track action without a connection, then place its cheapest station there free as its station placement. Blocks ${place('D17')} while player-owned. Closes at phase 6.`
            },
            {
                id: 'SQG',
                name: 'Ligne de Saint-Quentin à Guise',
                faceValue: 70,
                revenue: 0,
                closure: 'never',
                description: `Earns ₣70 while ${place('G10')} is green, ₣100 while it is brown, otherwise nothing. Companies cannot buy it in phases 6 and 7. Closes at phase D.`
            },
            {
                id: 'LS',
                name: 'London shipping',
                faceValue: 90,
                revenue: 15,
                description: `The owning company pays ₣40 for a ferry marker and may place its cheapest station free in the ${place(LondonShippingLocationId)} hex. A company with a station there adds the route’s largest other revenue, besides ${place(LuxembourgLocationId)}, to ${place(LondonLocationId)}. Closes at phase 6.`
            },
            {
                id: 'NMinorS',
                name: 'Nord minor shareholding',
                faceValue: 140,
                revenue: 20,
                description:
                    'Comes with a 10% Nord share, which never makes its owner the Nord’s president at once. Closes at phase 6.'
            },
            frenchMajorShareholding('PLMMS', 'PLM', 'PLM'),
            frenchMajorShareholding('OMMS', 'Ouest', 'Ouest'),
            frenchMajorShareholding('NMS', 'Nord', 'Nord'),
            frenchMajorShareholding('CMS', 'CFOR', 'CFOR'),
            frenchMajorShareholding('EMS', 'Est', 'Est'),
            {
                id: 'BMS',
                name: 'Belge major shareholding',
                faceValue: 200,
                revenue: 60,
                sale: 'never',
                description:
                    'Comes with the Belge president’s certificate; its buyer sets the Belge’s par at once. Cannot be sold to a company. Closes when the Belge operates.'
            }
        ]
    },
    EighteenNinetyFourPhases
)
export const EighteenNinetyFourPrivates = EighteenNinetyFourPrivateCatalog.privates
