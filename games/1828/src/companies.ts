import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import {
    BmId,
    BoId,
    CaId,
    CoId,
    CpId,
    CprId,
    CslId,
    DhId,
    EkId,
    ErieId,
    GtId,
    IcId,
    McId,
    MhId,
    MpId,
    NkpId,
    NwId,
    NycId,
    NyhId,
    OshId,
    PrrId,
    StctId,
    SvnId,
    WabId,
    directorPrivateId
} from './ids.js'
import { PrivateBlocks1828 } from './map.js'
import { Phases1828, PrivateClosurePhaseId } from './trains.js'

export * from './ids.js'

/** The sixteen public companies and their station markers, the first the home (table 13.1). */
export const Majors1828 = [
    { id: BmId, name: 'Boston & Maine', stations: 4 },
    { id: BoId, name: 'Baltimore & Ohio', stations: 3 },
    { id: CoId, name: 'Chesapeake & Ohio', stations: 3 },
    { id: CprId, name: 'Canadian Pacific Railway', stations: 4 },
    { id: GtId, name: 'Grand Trunk', stations: 3 },
    { id: ErieId, name: 'Erie Railroad', stations: 3 },
    { id: IcId, name: 'Illinois Central', stations: 4 },
    { id: McId, name: 'Michigan Central Railroad', stations: 4 },
    { id: MpId, name: 'Missouri Pacific Railroad', stations: 4 },
    { id: NycId, name: 'New York Central', stations: 3 },
    { id: NkpId, name: 'New York, Chicago & St. Louis Railroad', stations: 3 },
    { id: NyhId, name: 'New York, New Haven & Hartford', stations: 3 },
    { id: NwId, name: 'Norfolk & Western Railway', stations: 4 },
    { id: OshId, name: 'Ontario, Simcoe & Huron', stations: 4 },
    { id: PrrId, name: 'Pennsylvania Railroad', stations: 4 },
    { id: WabId, name: 'Wabash Railroad', stations: 3 }
] as const satisfies readonly { id: string; name: string; stations: number }[]
export const MajorIds1828: readonly string[] = Majors1828.map((company) => company.id)

/** A station marker beyond the home costs $100 (§8.3.2). */
export const StationPrice1828 = 100

/** The B&M and NYH may lay an extra yellow tile for $40 (§13.3.2). */
export const ExtraYellowCompanyIds: readonly string[] = [BmId, NyhId]

/**
 * The eight unsaleable $250 privates, each bringing its public company's directorship
 * (§13.2.3); some are left out at setup (§4).
 */
export const DirectorPrivates1828 = [
    { companyId: CprId, name: 'Canadian Pacific' },
    { companyId: GtId, name: 'Grand Trunk' },
    { companyId: IcId, name: 'Illinois Central' },
    { companyId: McId, name: 'Michigan Central' },
    { companyId: MpId, name: 'Missouri Pacific Railroad' },
    { companyId: NkpId, name: 'New York, Chicago & St. Louis Railroad' },
    { companyId: NwId, name: 'Norfolk & Western' },
    { companyId: OshId, name: 'Ontario, Simcoe & Huron' }
].map((entry) => ({ ...entry, id: directorPrivateId(entry.companyId) }))

/** The beginners' choice: one or more of these $250 privates stays in the game (§4). */
export const FriendlyDirectorCompanyIds: readonly string[] = [GtId, NwId, OshId]

/** The saleable privates' auction rows by face value, left to right (§4). */
export const SaleablePrivateRows: readonly (readonly string[])[] = [
    [SvnId, StctId],
    [CslId],
    [DhId, CpId],
    [MhId, EkId],
    [CaId]
]

/** The saleable privates in auction order. */
export const SaleablePrivateIds: readonly string[] = SaleablePrivateRows.flat()

/** The Cobourg & Peterborough's revenue once a company owns it (§13.2.2.5). */
export const CobourgCompanyRevenue = 15

const blocksWhilePlayerOwned = (privateId: string) => ({
    locationIds: [...PrivateBlocks1828[privateId]],
    until: 'company-owned' as const
})

export const PrivateCatalog1828 = new PrivateCatalog(
    {
        closurePhaseId: PrivateClosurePhaseId,
        privates: [
            {
                id: SvnId,
                name: 'Schuylkill Valley Navigation',
                faceValue: 20,
                revenue: 5,
                blocks: blocksWhilePlayerOwned(SvnId),
                description: `No special ability. Blocks ${place('G19')} while player-owned.`
            },
            {
                id: StctId,
                name: 'Saint Clair Tunnel',
                faceValue: 20,
                revenue: 5,
                blocks: blocksWhilePlayerOwned(StctId),
                description: `Pays $10 once a company owns it. Blocks Sarnia ${place('D10')} while player-owned.`
            },
            {
                id: CslId,
                name: 'Champlain & St. Lawrence Railroad',
                faceValue: 40,
                revenue: 10,
                blocks: blocksWhilePlayerOwned(CslId),
                description: `The owning company may lay a free yellow tile in Burlington ${place('B24')} at any time in its operations, besides its own lay and without a connection. Blocks ${place('B24')} while player-owned.`
            },
            {
                id: DhId,
                name: 'Delaware & Hudson Railroad',
                faceValue: 80,
                revenue: 15,
                blocks: blocksWhilePlayerOwned(DhId),
                description: `For $120 the owning company may lay or upgrade a tile in Scranton ${place('F20')} as its lay, without a connection, then place a free station there as its station. Blocks ${place('F20')} while player-owned.`
            },
            {
                id: CpId,
                name: 'Cobourg & Peterborough Railway',
                faceValue: 80,
                revenue: 0,
                blocks: blocksWhilePlayerOwned(CpId),
                description: `Its owner lays or upgrades a tile on track connected to Peterborough ${place('C15')} at the start of each operating round, earning half of a 2-train route through it; the other half builds the C&P's treasury. A company buying it takes the treasury and may replace the C&P station with its own; it then pays $15.`
            },
            {
                id: MhId,
                name: 'Mohawk & Hudson Railroad',
                faceValue: 120,
                revenue: 20,
                blocks: blocksWhilePlayerOwned(MhId),
                description: `Its owner may exchange it for any 10% share from the IPO or bank pool, or for half of a director's certificate, paying the other half, as a stock-round action or in an operating round. Blocks ${place('D22')} while player-owned.`
            },
            {
                id: EkId,
                name: 'Erie & Kalamazoo Railroad',
                faceValue: 120,
                revenue: 20,
                blocks: blocksWhilePlayerOwned(EkId),
                description: `A company buying it at once lays a yellow tile in Adrian/Ann Arbor ${place('E7')}. Once, the owning company may lay an extra yellow tile for $20 in its track step, not upgrading that round. Blocks ${place('E7')} while player-owned.`
            },
            {
                id: CaId,
                name: 'Camden & Amboy Railroad',
                faceValue: 160,
                revenue: 25,
                blocks: blocksWhilePlayerOwned(CaId),
                description: `Comes with a 10% share of the Pennsylvania Railroad. Blocks ${place('H22')} while player-owned.`
            },
            ...DirectorPrivates1828.map(({ id, name }) => ({
                id,
                name,
                faceValue: 250,
                revenue: 40,
                sale: 'never' as const,
                description:
                    'Comes with the 20% director’s certificate and a 10% share of its public company, whose par its buyer sets at once. Cannot be sold to a company. Closes when that company, or a system including it, acquires a train.'
            }))
        ]
    },
    Phases1828
)
export const Privates1828 = PrivateCatalog1828.privates
