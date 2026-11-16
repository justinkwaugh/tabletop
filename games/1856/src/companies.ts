import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import {
    BbgId,
    BridgeId,
    CaId,
    CanadaCompanyId,
    CgrId,
    CprId,
    CvId,
    FlosId,
    GtId,
    GwId,
    LpsId,
    ShippingId,
    TgbId,
    ThbId,
    TunnelId,
    WaterlooId,
    WgbId,
    WrId
} from './ids.js'
import { Phases1856, PrivateClosurePhaseId } from './trains.js'

export * from './ids.js'

/**
 * A company's destination: a route from ``from``, its home unless given, to any revenue center
 * of one of ``locationIds``.
 */
export type Destination1856 = { locationIds: readonly string[]; from?: string }

export type Major1856 = {
    id: string
    name: string
    home: string
    /** Free home station, then the charter's $40 and $100 circles (Starting a Company). */
    stationCosts: readonly number[]
    destination: Destination1856
    /** The Alternate Destinations variant's (Variants). */
    alternateDestination: Destination1856
}

const to = (...locationIds: string[]): Destination1856 => ({ locationIds })

/** The eleven public companies besides the CGR (Public Companies, Variants). */
export const Majors1856: readonly Major1856[] = [
    {
        id: BbgId,
        name: 'Buffalo, Brantford & Goderich Railway',
        home: 'J15',
        stationCosts: [0, 40, 100],
        destination: to('N17'),
        alternateDestination: to('N11')
    },
    {
        id: CaId,
        name: 'Canada Air Line Railway',
        home: 'D17',
        stationCosts: [0, 40, 100],
        destination: to('H15'),
        // Connect Detroit to London.
        alternateDestination: { locationIds: ['A20'], from: 'F15' }
    },
    {
        id: CprId,
        name: 'Canadian Pacific Railway',
        home: 'M4',
        stationCosts: [0, 40, 100, 100],
        destination: to('N11'),
        alternateDestination: to('P9')
    },
    {
        id: CvId,
        name: 'Credit Valley Railway',
        home: 'N11',
        stationCosts: [0, 40, 100],
        destination: to('I14'),
        alternateDestination: to('M4')
    },
    {
        id: GtId,
        name: 'Grand Trunk Railway',
        home: 'P9',
        stationCosts: [0, 40, 100, 100],
        destination: to('K8'),
        alternateDestination: to('L13')
    },
    {
        id: GwId,
        name: 'Great Western Railway',
        home: 'F15',
        stationCosts: [0, 40, 100, 100],
        destination: to('A20'),
        alternateDestination: to('J15')
    },
    {
        id: LpsId,
        name: 'London & Port Sarnia Railway',
        home: 'C14',
        stationCosts: [0, 40],
        destination: to('F17'),
        alternateDestination: to('F15')
    },
    {
        id: TgbId,
        name: 'Toronto, Grey & Bruce Railway',
        home: 'K8',
        stationCosts: [0, 40],
        destination: to('H5'),
        // Canadian West, one red area over two hexes.
        alternateDestination: to('O2', 'N1')
    },
    {
        id: ThbId,
        name: 'Toronto, Hamilton & Buffalo Railway',
        home: 'L15',
        stationCosts: [0, 40],
        destination: to('J11'),
        alternateDestination: to('H15')
    },
    {
        id: WrId,
        name: 'Welland Railway',
        home: 'O16',
        stationCosts: [0, 40, 100],
        destination: to('L15'),
        alternateDestination: to('L15')
    },
    {
        id: WgbId,
        name: 'Wellington, Grey & Bruce Railway',
        home: 'J11',
        stationCosts: [0, 40],
        destination: to('F9'),
        alternateDestination: to('H5')
    }
]
export const MajorIds1856: readonly string[] = Majors1856.map((company) => company.id)

export function major1856(companyId: string): Major1856 | undefined {
    return Majors1856.find((company) => company.id === companyId)
}

export const CgrName = 'Canadian Government Railways'
/** The CGR's ten station markers; those beyond its absorbed companies' cost $100 (Token Exchange). */
export const CgrStationCount = 10
export const CgrStationCost = 100

export const PrivateCatalog1856 = new PrivateCatalog(
    {
        closurePhaseId: PrivateClosurePhaseId,
        privates: [
            {
                id: FlosId,
                name: 'Flos Tramway',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: ['L3'], until: 'company-owned' },
                description: `No special ability. Blocks ${place('L3')} while player-owned.`
            },
            {
                id: WaterlooId,
                name: 'Waterloo & Saugeen Railway Co.',
                faceValue: 40,
                revenue: 10,
                blocks: { locationIds: ['I12'], until: 'company-owned' },
                description: `The owning company may place a free station in either city of ${place('I12')}, and may lay the Kitchener tile if it is not yet laid, without a route there, in place of its own station and tile. Closes at the end of the operating round in which it is used. Blocks ${place('I12')} while player-owned.`
            },
            {
                id: CanadaCompanyId,
                name: 'The Canada Company',
                faceValue: 50,
                revenue: 10,
                blocks: { locationIds: ['H11'], until: 'company-owned' },
                description: `The owning company may lay a tile in ${place('H11')} in its turn, besides its own lay and without a route there. Blocks ${place('H11')} while player-owned.`
            },
            {
                id: ShippingId,
                name: 'Great Lakes Shipping Company',
                faceValue: 70,
                revenue: 15,
                description:
                    'In its turn the owning company may place the port token in a city or red area with an anchor: that place pays it $20 more. Placing the token closes the private; the token is removed when the first 6-train is bought.'
            },
            {
                id: BridgeId,
                name: 'Niagara Falls Suspension Bridge Company',
                faceValue: 100,
                revenue: 20,
                description: `The owning company adds $10 when running to ${place('P17')}. Other companies may buy that right for $50 from the owning company, or from the bank once the private has closed, but not while a player owns it.`
            },
            {
                id: TunnelId,
                name: 'St. Clair Frontier Tunnel Company',
                faceValue: 100,
                revenue: 20,
                description: `The owning company adds the $10 Port Huron bonus when running to ${place('B13')}. Other companies may buy that right for $50 from the owning company, or from the bank once the private has closed, but not while a player owns it.`
            }
        ]
    },
    Phases1856
)
export const Privates1856 = PrivateCatalog1856.privates
export const PrivateIds1856: readonly string[] = Privates1856.map((company) => company.id)

/** Every company's display name, the CGR's among them. */
export const CompanyNames1856: Readonly<Record<string, string>> = Object.fromEntries([
    ...Majors1856.map((company) => [company.id, company.name]),
    [CgrId, CgrName],
    ...Privates1856.map((company) => [company.id, company.name])
])
