import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import {
    BoId,
    BopId,
    BsId,
    CaId,
    CoId,
    CocId,
    CpId,
    CvId,
    DrId,
    LvId,
    NwId,
    PleId,
    PrrId,
    SrrId
} from './ids.js'
import { PhasesChesapeake } from './trains.js'

export * from './ids.js'

/** The public companies, with their station costs; home stations are free. */
export const MajorsChesapeake = [
    { id: PrrId, name: 'Pennsylvania Railroad', stationCosts: [0, 40, 60, 80] },
    { id: PleId, name: 'Pittsburgh & Lake Erie Railroad', stationCosts: [0, 40, 60] },
    { id: SrrId, name: 'Strasburg Rail Road', stationCosts: [0, 40] },
    { id: BoId, name: 'Baltimore & Ohio Railroad', stationCosts: [0, 40, 60] },
    { id: CoId, name: 'Chesapeake & Ohio Railroad', stationCosts: [0, 40, 60, 80] },
    { id: LvId, name: 'Lehigh Valley Railroad', stationCosts: [0, 40] },
    { id: CaId, name: 'Camden & Amboy Railroad', stationCosts: [0, 40] },
    { id: NwId, name: 'Norfolk & Western Railway', stationCosts: [0, 40, 60] }
] as const satisfies readonly { id: string; name: string; stationCosts: readonly number[] }[]
export type MajorIdChesapeake = (typeof MajorsChesapeake)[number]['id']
export const MajorIdsChesapeake: readonly string[] = MajorsChesapeake.map((company) => company.id)

/** The two-tile privates' hexes, laid together with tile 8 or 9. */
export const PairedLays: Readonly<Record<string, readonly [string, string]>> = {
    [CpId]: ['H2', 'I3'],
    [BsId]: ['F4', 'G5']
}

export const PrivateCatalogChesapeake = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: DrId,
                name: 'Delaware & Raritan Canal',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: ['K3'], until: 'company-owned' },
                description: `No special ability. Blocks ${place('K3')} while player-owned. Closes at phase 5.`
            },
            {
                id: CpId,
                name: 'Columbia – Philadelphia Railroad',
                faceValue: 40,
                revenue: 10,
                blocks: { locationIds: ['H2', 'I3'], until: 'company-owned' },
                description: `The owning company may lay two connected tiles 8 or 9 in ${place('H2')} and ${place('I3')}, without a connection and besides its ordinary lay. Lost if anyone else lays a tile there. Blocks both hexes while player-owned. Closes at phase 5.`
            },
            {
                id: BsId,
                name: 'Baltimore & Susquehanna Railroad',
                faceValue: 50,
                revenue: 10,
                blocks: { locationIds: ['F4', 'G5'], until: 'company-owned' },
                description: `The owning company may lay two connected tiles 8 or 9 in ${place('F4')} and ${place('G5')}, without a connection and besides its ordinary lay. Lost if anyone else lays a tile there. Blocks both hexes while player-owned. Closes at phase 5.`
            },
            {
                id: CocId,
                name: 'Chesapeake & Ohio Canal',
                faceValue: 80,
                revenue: 15,
                blocks: { locationIds: ['D2'], until: 'company-owned' },
                description: `The owning company may lay tile 57 on ${place('D2')} as its tile lay, without a connection and paying the terrain, then place a free station there. Blocks ${place('D2')} while player-owned. Closes at phase 5.`
            },
            {
                id: BopId,
                name: 'Baltimore & Ohio Railroad',
                faceValue: 100,
                revenue: 0,
                description:
                    'Whoever buys it in the opening auction also receives a 10% B&O share. No other ability. Closes at phase 5.'
            },
            {
                id: CvId,
                name: 'Cornelius Vanderbilt',
                faceValue: 200,
                revenue: 30,
                sale: 'never',
                description:
                    'Comes with the president’s certificate of a company drawn at setup; its buyer sets that company’s par. Cannot be sold to a company. Closes when that company buys its first train, or at phase 5.'
            }
        ]
    },
    PhasesChesapeake
)
export const PrivatesChesapeake = PrivateCatalogChesapeake.privates
