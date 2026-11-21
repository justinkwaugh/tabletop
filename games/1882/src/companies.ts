import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import {
    CnId,
    CnorId,
    CpId,
    CprId,
    GtpId,
    HbId,
    HbrId,
    NwrId,
    QlId,
    ScId,
    ScrId,
    TbId
} from './ids.js'
import { Phases1882 } from './trains.js'

export * from './ids.js'

/** The public companies (§10.4), with their station costs; home stations are free (§11.4). */
export const Majors1882 = [
    { id: CnId, name: 'Canadian National Railway', stationCosts: [] },
    { id: CnorId, name: 'Canadian Northern Railway', stationCosts: [0, 40, 100] },
    { id: CprId, name: 'Canadian Pacific Railway', stationCosts: [0, 40, 100, 100] },
    { id: GtpId, name: 'Grand Trunk Pacific Railway', stationCosts: [0, 40, 100] },
    { id: HbrId, name: 'Hudson Bay Railway', stationCosts: [0, 40, 100] },
    { id: QlId, name: 'Qu’Appelle, Long Lake & Saskatchewan Railway', stationCosts: [0, 40] },
    { id: ScrId, name: 'Saskatchewan Central Railway', stationCosts: [0] }
] as const satisfies readonly { id: string; name: string; stationCosts: readonly number[] }[]
export type MajorId1882 = (typeof Majors1882)[number]['id']

export { NeutralHolders1882 } from './neutralStationDefinitions.js'

/** The companies the Trestle Bridge's share is drawn from (§3). */
export const TrestleShareCompanyIds: readonly string[] = [CnorId, CprId, GtpId, HbrId, QlId]

/** The Trestle Bridge's owner earns this for each new river crossing (§7.1.4). */
export const CrossingIncome = 10

export const PrivateCatalog1882 = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: HbId,
                name: 'Hudson Bay Company',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: ['C11'], until: 'company-owned' },
                description: `Blocks ${place('C11')} while player-owned. Closes at phase 5.`
            },
            {
                id: ScId,
                name: 'Saskatchewan Central Company',
                faceValue: 50,
                revenue: 10,
                blocks: { locationIds: ['H4'], until: 'company-owned' },
                closure: { closurePhaseId: '6' },
                description: `Blocks ${place('H4')} while player-owned. In a stock turn its owner may exchange it, as their purchase, for the president’s certificate of the Saskatchewan Central Railway, setting its par, paying for one share and placing its home in any open city or on a neutral station. Closes at phase 6, or when exchanged.`
            },
            {
                id: NwrId,
                name: 'North-West Rebellion Company',
                faceValue: 80,
                revenue: 15,
                description:
                    'Once, its owning company may move one of its stations from outside the rebellion hexes to an open city in one, free and unconnected, then lay or upgrade a tile there. A moved home leaves a neutral station. Closes at phase 5.'
            },
            {
                id: TbId,
                name: 'Trestle Bridge Company',
                faceValue: 140,
                revenue: 0,
                blocks: { locationIds: ['G9'], until: 'company-owned' },
                description: `Pays $10 for each new river crossing any company completes, instead of income. Comes with a 10% share drawn at setup. Blocks ${place('G9')} while player-owned. Closes at phase 5.`
            },
            {
                id: CpId,
                name: 'Canadian Pacific Company',
                faceValue: 180,
                revenue: 25,
                sale: 'never',
                description:
                    'Comes with the CPR president’s certificate; its buyer sets the CPR’s par. Cannot be sold to a company. Closes at phase 5, or when the CPR buys a train.'
            }
        ]
    },
    Phases1882
)
export const Privates1882 = PrivateCatalog1882.privates
