import {
    companyCharters,
    createOrdinaryShareCertificates,
    homeStationId,
    treasuryPoolId,
    type OpenShare,
    type RevenueCenter
} from '@tabletop/18xx'
import { Privates1822 } from './privates.js'
import { ConcessionRevenue1822 } from './setup.js'

export type Major1822 = {
    id: string
    name: string
    /** The initials the charter prints, where they differ from the id. */
    initials: string
    color: string
    home: RevenueCenter
    destination: RevenueCenter
}

export const LnwrId = 'LNWR'
export const SecrId = 'SECR'
/** The city node of a hex with one city. */
const City = 'city'
export const LondonLocationId = 'M38'

const london = (nodeId: string): RevenueCenter => ({ locationId: LondonLocationId, nodeId })
const city = (locationId: string): RevenueCenter => ({ locationId, nodeId: City })

// The ten major companies with their homes and destinations (§3.4.1, Table 6).
export const Majors1822: readonly Major1822[] = [
    {
        id: LnwrId,
        name: 'London and North West Railway',
        initials: 'LNWR',
        color: '#1a1a1a',
        home: london('n'),
        destination: city('I22')
    },
    {
        id: 'GWR',
        name: 'Great Western Railway',
        initials: 'GWR',
        color: '#165016',
        home: london('sw'),
        destination: city('G36')
    },
    {
        id: 'LBSCR',
        name: 'London, Brighton and South Coast Railway',
        initials: 'LBSCR',
        color: '#cccc00',
        home: london('s'),
        destination: city('M42')
    },
    {
        id: SecrId,
        name: 'South Eastern & Chatham Railway',
        initials: 'SECR',
        color: '#ff7f2a',
        home: london('se'),
        destination: city('P41')
    },
    {
        id: 'CR',
        name: 'Caledonian Railway',
        initials: 'CR',
        color: '#5555ff',
        home: city('E6'),
        destination: city('G12')
    },
    {
        id: 'MR',
        name: 'Midland Railway',
        initials: 'MR',
        color: '#ff2a2a',
        home: city('J29'),
        destination: city('L19')
    },
    {
        id: 'LYR',
        name: 'Lancashire & Yorkshire Railway',
        initials: 'L&YR',
        color: '#5a2ca0',
        home: city('G22'),
        destination: city('I22')
    },
    {
        id: 'NBR',
        name: 'North British Railway',
        initials: 'NBR',
        color: '#a05a2c',
        home: city('H5'),
        destination: city('H1')
    },
    {
        id: 'SWR',
        name: 'South Wales Railway',
        initials: 'SWR',
        color: '#999999',
        home: city('H33'),
        destination: city('C34')
    },
    {
        id: 'NER',
        name: 'North Eastern Railway',
        initials: 'NER',
        color: '#aade87',
        home: city('L19'),
        destination: city('H5')
    }
]
export const MajorIds1822: readonly string[] = Majors1822.map(({ id }) => id)

export function major1822(companyId: string): Major1822 | undefined {
    return Majors1822.find((major) => major.id === companyId)
}

export type Minor1822 = {
    id: string
    name: string
    initials: string
    /**
     * Its home station. The Metropolitan Railway has none printed: it pays £20 to place its home on
     * the London roundel, beside whichever London station it chooses (§5.6.7, §5.10.3).
     */
    home?: RevenueCenter
    /** One of the six minor companies of the 1822+ expansion (§3.3.1). */
    expansion?: true
}

/** The Metropolitan Railway, whose home is a space of the London roundel (§5.10.3). */
export const MetropolitanId = 'M14'
/** The Swansea and Mumbles Railway, always first in its stack (§2.1.5). */
export const FirstMinorId = 'M24'
/** What the Metropolitan Railway pays to place its home station (§5.6.7). */
export const MetropolitanHomeCost1822 = 20

const minor = (
    number: number,
    name: string,
    initials: string,
    home?: RevenueCenter
): Minor1822 => ({
    id: `M${number}`,
    name,
    initials,
    ...(home ? { home } : {}),
    ...(number > 24 ? { expansion: true as const } : {})
})

// The minor companies and their homes (§3.3.1, Table 4).
export const Minors1822: readonly Minor1822[] = [
    minor(1, 'Great North of Scotland Railway', 'GNoSR', city('H1')),
    minor(2, 'Lanarkshire & Dunbartonshire Railway', 'L&DR', city('E2')),
    minor(3, 'Edinburgh & Dalkeith Railway', 'E&DR', city('H5')),
    minor(4, 'Newcastle & North Shields Railway', 'N&NSR', city('K10')),
    minor(5, 'Stockton and Darlington Railway', 'S&DR', city('J15')),
    minor(6, 'Furness Railway', 'FR', city('G16')),
    minor(7, 'Warrington & Newton Railway', 'W&NR', city('H23')),
    minor(8, 'Manchester Sheffield & Lincolnshire Railway', 'MS&LR', city('K24')),
    minor(9, 'East Lincolnshire Railway', 'ELR', city('N23')),
    minor(10, 'Grand Junction Railway', 'GJR', city('I30')),
    minor(11, 'Great Northern Railway', 'GNR', city('M30')),
    minor(12, 'Eastern Union Railway', 'EUR', city('P35')),
    minor(13, 'Headcorn & Maidstone Junction Light Railway', 'H&MJLR', city('O40')),
    minor(14, 'Metropolitan Railway', 'MetR'),
    minor(15, 'London Tilbury & Southend Railway', 'LT&SR', london('ne')),
    minor(16, 'London & Birmingham Railway', 'L&BR', london('nw')),
    minor(17, 'London & Southampton Railway', 'L&SR', city('J41')),
    minor(18, 'Somerset & Dorset Joint Railway', 'S&DJR', city('I42')),
    minor(19, 'Penarth Harbour & Dock Railway Company', 'PH&DRC', city('F35')),
    minor(20, 'Monmouthshire Railway & Canal Company', 'MR&CC', city('F33')),
    minor(21, 'Taff Vale Railway', 'TVR', city('E34')),
    minor(22, 'Exeter and Crediton Railway', 'E&CR', city('D41')),
    minor(23, 'West Cornwall Railway', 'WCR', city('A42')),
    minor(24, 'Swansea and Mumbles Railway', 'S&MR', city('D35')),
    minor(25, 'Yarmouth & Norwich Railway', 'Y&NR', city('Q30')),
    minor(26, 'Hull and Selby Railway', 'H&SR', city('N21')),
    minor(27, 'City of Glasgow Union Railway', 'CGR', city('E6')),
    minor(28, 'Maryport and Carlisle Railway', 'M&CR', city('G12')),
    minor(29, 'Shropshire and Montgomeryshire Railway', 'S&MR', city('E28')),
    minor(30, 'Plymouth and Dartmoor Railway', 'P&DR', city('B43'))
]
export const MinorIds1822: readonly string[] = Minors1822.map(({ id }) => id)

export function minor1822(companyId: string): Minor1822 | undefined {
    return Minors1822.find((entry) => entry.id === companyId)
}

/** The companies whose printed home is the London station, the Metropolitan Railway choosing its own (§5.10). */
export function londonHomeCompanyIds1822(nodeId: string): string[] {
    return [...Majors1822, ...Minors1822]
        .filter(
            (company) =>
                company.id !== MetropolitanId &&
                company.home?.locationId === LondonLocationId &&
                company.home.nodeId === nodeId
        )
        .map((company) => company.id)
}

/** A major company's concession, bid for and later converted to its director's certificate (§3.2). */
export function concessionId(majorId: string): string {
    return `C-${majorId}`
}
export const ConcessionIds1822: readonly string[] = MajorIds1822.map(concessionId)
/** The London & North West Railway's concession, always first in its stack (§2.1.4). */
export const FirstConcessionId = concessionId(LnwrId)

/** The major company a concession converts to. */
export function concessionMajorId(companyId: string): string | undefined {
    return MajorIds1822.find((majorId) => concessionId(majorId) === companyId)
}

export const MajorShareCount1822 = 10
/**
 * A minor company is a 50% director's certificate counting as two shares, with the other half
 * embedded in the company, which so keeps half its earnings (§3.3.2, §3.3.7).
 */
export const MinorShareCount1822 = 4
const MinorCertificateShares = 2

/** The shares of a major's director's certificate: two, or one for the LNWR (§3.4.2). */
export function directorShares1822(companyId: string): number {
    return companyId === LnwrId ? 1 : 2
}

type Allocation = Pick<OpenShare, 'owner' | 'poolId'>

function treasury(companyId: string): Allocation {
    return { owner: { kind: 'company', companyId }, poolId: treasuryPoolId(companyId) }
}

/**
 * A major company's certificates, all with the company until bought: the director's of 20% and
 * eight of 10%, or for the LNWR ten of 10% of which one is the director's (§3.4.2, §3.4.3).
 */
export function createMajorCertificates1822(companyId: string): OpenShare[] {
    const director = directorShares1822(companyId)
    const held = treasury(companyId)
    return createOrdinaryShareCertificates(
        companyId,
        Array.from({ length: MajorShareCount1822 - director }, () => held),
        held
    ).map((certificate) =>
        certificate.president ? { ...certificate, shares: director } : certificate
    )
}

export function minorDirectorCertificateId(companyId: string): string {
    return `${companyId}:president`
}
export function minorEmbeddedCertificateId(companyId: string): string {
    return `${companyId}:embedded`
}

/**
 * A minor company's director's certificate, held where `director` says until it is bought, and
 * the half that never leaves the company (§3.3.2).
 */
export function createMinorCertificates1822(companyId: string, director: Allocation): OpenShare[] {
    return [
        {
            id: minorDirectorCertificateId(companyId),
            companyId,
            kind: 'share',
            shares: MinorCertificateShares,
            president: true,
            ...director
        },
        {
            id: minorEmbeddedCertificateId(companyId),
            companyId,
            kind: 'share',
            shares: MinorCertificateShares,
            ...treasury(companyId)
        }
    ]
}

export type StationKind1822 = 'home' | 'destination' | 'available' | 'exchange'
export type CompanyStation1822 = { id: string; kind: StationKind1822 }

export function destinationStationId(companyId: string): string {
    return `${companyId}:destination`
}
export function availableStationId(companyId: string): string {
    return `${companyId}:station:1`
}
export function exchangeStationId(companyId: string, number: number): string {
    return `${companyId}:exchange:${number}`
}

/** A major company's exchange tokens: three, or four for the LNWR (§5.6.3). */
export function exchangeTokenCount1822(companyId: string): number {
    return companyId === LnwrId ? 4 : 3
}

/**
 * A major company's station tokens: its home, its destination, one available and its exchange
 * tokens, six in all and seven for the LNWR (§5.6.2, §5.6.3, §5.12.1, §5.12.2).
 */
export function majorStations1822(companyId: string): CompanyStation1822[] {
    return [
        { id: homeStationId(companyId), kind: 'home' },
        { id: destinationStationId(companyId), kind: 'destination' },
        { id: availableStationId(companyId), kind: 'available' },
        ...Array.from(
            { length: exchangeTokenCount1822(companyId) },
            (_, index): CompanyStation1822 => ({
                id: exchangeStationId(companyId, index + 1),
                kind: 'exchange'
            })
        )
    ]
}

/** A minor company's one station token, its home (§5.12.3). */
export function minorStations1822(companyId: string): CompanyStation1822[] {
    return [{ id: homeStationId(companyId), kind: 'home' }]
}

/** What a station token costs to place, other than a home, destination or exchange token (§5.12.12). */
export const StationCost1822 = 100

export const Charters1822 = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...MajorIds1822.map((id) => [id, MajorShareCount1822]),
        ...MinorIds1822.map((id) => [id, MinorShareCount1822])
    ]),
    privateRevenues: Object.fromEntries([
        ...Privates1822.map((company) => [company.id, company.revenue]),
        ...ConcessionIds1822.map((id) => [id, ConcessionRevenue1822])
    ])
}))
