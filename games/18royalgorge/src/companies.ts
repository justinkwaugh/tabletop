import { assertExists } from '@tabletop/common'
import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import {
    BridgeLeaseId,
    CfiId,
    CmId,
    CoalCreekId,
    CoalDepotId,
    CsId,
    CsccId,
    DocHollidayId,
    FccId,
    GhostTownId,
    GoldMinerId,
    JewelerId,
    KpId,
    MetalsInvestorId,
    MintWorkerId,
    NoId,
    NuggetId,
    OilFieldsId,
    PalmerId,
    PavId,
    PrisonId,
    RgId,
    SId,
    SfId,
    SilverMinesId,
    SppId,
    StCloudId,
    SteelDepotId,
    SulphurSpringsId,
    TrackEngineerId,
    VgcId
} from './ids.js'
import { BrownFivePhaseId, PhasesRoyalGorge } from './trains.js'

export * from './ids.js'

export type RailroadRoyalGorge = {
    id: string
    name: string
    /** The year on the charter, which orders the railroads into tranches (SC-1). */
    established: number
    stationCosts: readonly number[]
}

const costs = (count: number) => [0, 40, 60, 80].slice(0, count)

/** Santa Fe and Rio Grande are in every game (Setup, step 3). */
export const FixedRailroads: readonly RailroadRoyalGorge[] = [
    { id: RgId, name: 'Denver & Rio Grande Western', established: 1870, stationCosts: costs(3) },
    { id: SfId, name: 'Santa Fe Railroad', established: 1876, stationCosts: costs(4) }
]

/** Three of these are drawn for each game (Setup, step 3). */
export const DrawnRailroads: readonly RailroadRoyalGorge[] = [
    { id: KpId, name: 'Kansas Pacific Railway', established: 1869, stationCosts: costs(4) },
    {
        id: SppId,
        name: 'Denver, South Park & Pacific Railroad',
        established: 1872,
        stationCosts: costs(4)
    },
    {
        id: PavId,
        name: 'Pueblo & Arkansas Valley Railroad',
        established: 1875,
        stationCosts: costs(4)
    },
    { id: NoId, name: 'Denver & New Orleans', established: 1881, stationCosts: costs(3) },
    { id: CmId, name: 'Colorado Midland Railway', established: 1883, stationCosts: costs(3) },
    { id: SId, name: 'Silverton Railroad', established: 1887, stationCosts: costs(3) },
    {
        id: FccId,
        name: 'Florence & Cripple Creek Railroad',
        established: 1893,
        stationCosts: costs(2)
    },
    {
        id: CsccId,
        name: 'Colorado Springs & Cripple Creek District',
        established: 1897,
        stationCosts: costs(2)
    },
    { id: CsId, name: 'Colorado & Southern', established: 1898, stationCosts: costs(2) }
]

export const RailroadsRoyalGorge: readonly RailroadRoyalGorge[] = [
    ...FixedRailroads,
    ...DrawnRailroads
]
export const RailroadIdsRoyalGorge: readonly string[] = RailroadsRoyalGorge.map((rail) => rail.id)

export function railroad(companyId: string): RailroadRoyalGorge {
    const found = RailroadsRoyalGorge.find((rail) => rail.id === companyId)
    assertExists(found, `Unknown 18RoyalGorge railroad ${companyId}`)
    return found
}

/** The steel and gold companies: ten single shares each, no president, never operating. */
export const MetalCompanyKind = 'metal'
export const MetalsRoyalGorge = [
    { id: CfiId, name: 'Colorado Fuel & Iron' },
    { id: VgcId, name: 'Victor Gold Company' }
] as const
export const MetalIdsRoyalGorge: readonly string[] = MetalsRoyalGorge.map((metal) => metal.id)

export type PrivateTier = 'yellow' | 'green' | 'brown'
type PrivateCard = {
    id: string
    name: string
    faceValue: number
    revenue: number
    tier: PrivateTier
    /** Only a player may own it (the card has no locomotive; OQ-10). */
    playerOnly?: true
    /** It never closes, or closes only by its own text, not at the first 5+ (PV-2). */
    staysOpen?: true
    description: string
}

/**
 * The private assets: the cards' texts with the rulebook's reference notes and the designer's
 * rulings (digest §2.10); incomes start in the phase noted.
 */
export const PrivateCardsRoyalGorge: readonly PrivateCard[] = [
    {
        id: StCloudId,
        name: 'St. Cloud Hotel',
        faceValue: 50,
        revenue: 5,
        tier: 'yellow',
        staysOpen: true,
        description: `Owned by a railroad, its trains earn $20 more for stopping at the hotel: ${place('G17')}, then ${place('H12')} from the Brown phase. Never closes.`
    },
    {
        id: GhostTownId,
        name: 'Ghost Town Tour Co.',
        faceValue: 45,
        revenue: 15,
        tier: 'yellow',
        description:
            'When its railroad ships the last gold from a mine, it may place one of 4 ghost towns there; each of its routes earns $10 for every ghost town it runs through. Closes with the first 5+.'
    },
    {
        id: CoalCreekId,
        name: 'Coal Creek Mines',
        faceValue: 40,
        revenue: 5,
        tier: 'yellow',
        description: `Owned by a railroad, it takes a coal cube, of 12, whenever any railroad runs through ${place('H14')}. Each turn the railroad may spend up to 2 cubes, each adding a stop to one of its trains. Closes with the first 5+.`
    },
    {
        id: PalmerId,
        name: 'William Palmer',
        faceValue: 75,
        revenue: 5,
        tier: 'yellow',
        playerOnly: true,
        description:
            'Its buyer also takes a 10% share of Rio Grande and a 10% share of CF&I; Rio Grande receives nothing for it. Only a player may own it. Closes with the first 5+.'
    },
    {
        id: PrisonId,
        name: 'Colorado State Prison Labor Force',
        faceValue: 70,
        revenue: 10,
        tier: 'yellow',
        description:
            'Owned by a railroad, it pays half of every terrain cost. Closes with the first 5+.'
    },
    {
        id: JewelerId,
        name: 'Local Jeweler',
        faceValue: 20,
        revenue: 5,
        tier: 'yellow',
        playerOnly: true,
        description:
            'Every gold shipment puts $5 from the bank on this card; its owner takes the money as each stock round begins, and loses it if the card closes. Only a player may own it. Closes with the first 5+.'
    },
    {
        id: DocHollidayId,
        name: 'Doc Holliday',
        faceValue: 55,
        revenue: 10,
        tier: 'green',
        playerOnly: true,
        staysOpen: true,
        description:
            'At the Treaty of Boston Santa Fe owes Doc 2 debts; what Santa Fe pays for them goes to his owner. Only a player may own him. Closes when Santa Fe has paid both.'
    },
    {
        id: NuggetId,
        name: '13lb Gold Nugget',
        faceValue: 40,
        revenue: 5,
        tier: 'green',
        description:
            'Once in the game its railroad may ship a gold for $130 instead of $50, closing it. Closes with the first 5+.'
    },
    {
        id: BridgeLeaseId,
        name: 'Hanging Bridge Lease',
        faceValue: 50,
        revenue: 10,
        tier: 'green',
        description: `The owning company may run through the ${place('E13')} by paying a 10% dividend to the Rio Grande from the proceeds, using either the charter or the president's personal cash. Not for placing stations. Closes with the first 5+.`
    },
    {
        id: OilFieldsId,
        name: 'Florence Oil Fields',
        faceValue: 75,
        revenue: 25,
        tier: 'green',
        playerOnly: true,
        staysOpen: true,
        description:
            'Pays $25 a round from the Green phase. Only a player may own it. Never closes, and counts toward the certificate limit.'
    },
    {
        id: MetalsInvestorId,
        name: 'Metals Investor',
        faceValue: 25,
        revenue: 5,
        tier: 'green',
        playerOnly: true,
        description:
            'Each stock round its owner may buy one CF&I and one VGC share a space below their price; shares bought so may not be sold until the next stock round. Only a player may own it. Closes with the first 5+.'
    },
    {
        id: CoalDepotId,
        name: 'Coal Depot',
        faceValue: 10,
        revenue: 5,
        tier: 'green',
        description:
            'Comes with a coal cube for each $10 of its winning bid. Each turn its railroad may spend 1 or 2 cubes to add as many stops to one train, not the Track Engineer’s. Closes with the first 5+.'
    },
    {
        id: SilverMinesId,
        name: 'Silver Mines',
        faceValue: 70,
        revenue: 25,
        tier: 'brown',
        staysOpen: true,
        description:
            'Pays $25 a round from the Brown phase. Never closes, and counts toward the certificate limit.'
    },
    {
        id: SulphurSpringsId,
        name: 'Sulphur Springs',
        faceValue: 50,
        revenue: 50,
        tier: 'brown',
        staysOpen: true,
        description:
            'Owned by a railroad, it may close to turn its town into the city of the same colour. Owned by a player, it pays $50 a round from the Brown phase once its town has a tile. Never closes otherwise.'
    },
    {
        id: SteelDepotId,
        name: 'Steel Depot',
        faceValue: 55,
        revenue: 10,
        tier: 'brown',
        description:
            'Holds 5 steel. Each turn its railroad may take up to 2 of them, free, for yellow tiles, within its six lays. Closes with the first 5+.'
    },
    {
        id: GoldMinerId,
        name: 'Gold Miner',
        faceValue: 20,
        revenue: 0,
        tier: 'brown',
        playerOnly: true,
        description:
            'Its owner receives VGC’s dividend on two more shares, paid by the bank, which do not move VGC’s price. Only a player may own it. Closes with the first 5+.'
    },
    {
        id: TrackEngineerId,
        name: 'Track Engineer',
        faceValue: 60,
        revenue: 10,
        tier: 'brown',
        description:
            'Each turn its railroad may add a stop to one train, not the one the Coal Depot lengthens. Closes with the first 5+.'
    },
    {
        id: MintWorkerId,
        name: 'U.S. Mint Worker',
        faceValue: 40,
        revenue: 5,
        tier: 'brown',
        playerOnly: true,
        staysOpen: true,
        description:
            'In a stock round, as its owner’s purchase, it may close to buy 1 or 2 VGC shares at half price. Only a player may own it.'
    }
]

/** The phase each private begins paying in; the rest pay from the start (PV-1). */
export const IncomeFromPhase: Readonly<Record<string, 'Green' | 'Brown'>> = {
    [OilFieldsId]: 'Green',
    [SilverMinesId]: 'Brown',
    [SulphurSpringsId]: 'Brown'
}

export const PrivateCatalogRoyalGorge = new PrivateCatalog(
    {
        closurePhaseId: BrownFivePhaseId,
        privates: PrivateCardsRoyalGorge.map((card) => ({
            id: card.id,
            name: card.name,
            faceValue: card.faceValue,
            revenue: card.revenue,
            description: card.description,
            ...(card.staysOpen ? { closure: 'never' as const } : {}),
            ...(card.playerOnly ? { sale: 'never' as const } : {})
        }))
    },
    PhasesRoyalGorge
)

export function privateCard(privateCompanyId: string): PrivateCard {
    const card = PrivateCardsRoyalGorge.find((entry) => entry.id === privateCompanyId)
    assertExists(card, `Unknown 18RoyalGorge private ${privateCompanyId}`)
    return card
}
