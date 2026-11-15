import { assertExists } from '@tabletop/common'
import { companyCharters, type RevenueCenter } from '@tabletop/18xx'
import { Privates1861 } from './privates.js'

export type Minor1861 = {
    id: string
    name: string
    color: string
    home: RevenueCenter
    /** Available from the start, or only from phase 3 (§7.2). */
    available: 'start' | 'phase-3'
}

export type Major1861 = {
    id: string
    name: string
    color: string
}

const City = 'city'
const city = (locationId: string, nodeId = City): RevenueCenter => ({ locationId, nodeId })

/** The Nikolaev, auctioned straight after the privates, before any other minor (§9.4). */
export const NikolaevId = 'N'

// The sixteen minor companies and their homes (§7.2).
export const Minors1861: readonly Minor1861[] = [
    {
        id: NikolaevId,
        name: 'Nikolaev Railway',
        color: '#d30869',
        home: city('H8', 'city-1'),
        available: 'start'
    },
    {
        id: 'K-B',
        name: 'Kiev–Brest Railway',
        color: '#4cb5d2',
        home: city('D14', 'city-1'),
        available: 'start'
    },
    {
        id: 'K-K',
        name: 'Kiev–Kursk Railway',
        color: '#0097df',
        home: city('D14', 'city-2'),
        available: 'start'
    },
    {
        id: 'K-R',
        name: 'Kharkov–Rostov Railway',
        color: '#b0479a',
        home: city('G15'),
        available: 'start'
    },
    {
        id: 'M-K',
        name: 'Moscow–Kursk Railway',
        color: '#8d6e63',
        home: city('H8', 'city-0'),
        available: 'start'
    },
    {
        id: 'M-NN',
        name: 'Moscow–Nizhnii Novgorod Railway',
        color: '#ff7043',
        home: city('H8', 'city-2'),
        available: 'start'
    },
    {
        id: 'M-V',
        name: 'Moscow–Voronezh Railway',
        color: '#b7274c',
        home: city('I13'),
        available: 'start'
    },
    {
        id: 'O-K',
        name: 'Odessa–Kiev Railway',
        color: '#c49a00',
        home: city('D20'),
        available: 'start'
    },
    {
        id: 'R-O',
        name: 'Riga–Orel Railway',
        color: '#009595',
        home: city('B4'),
        available: 'start'
    },
    {
        id: 'SP-W',
        name: 'St. Petersburg–Warsaw Railway',
        color: '#5c6bc0',
        home: city('E1', 'city-0'),
        available: 'start'
    },
    {
        id: 'Y',
        name: 'Yuzovka Railway',
        color: '#f3716d',
        home: city('H18'),
        available: 'phase-3'
    },
    {
        id: 'E',
        name: 'Ekaterinin Railway',
        color: '#3949ab',
        home: city('Q3'),
        available: 'phase-3'
    },
    {
        id: 'M-B',
        name: 'Moscow–Brest Railway',
        color: '#2e4a8b',
        home: city('E9'),
        available: 'phase-3'
    },
    {
        id: 'S-V',
        name: 'Samara–Vyazma Railway',
        color: '#00796b',
        home: city('N10'),
        available: 'phase-3'
    },
    {
        id: 'T-R',
        name: 'Tsaritsyn–Riga Railway',
        color: '#689f38',
        home: city('K17'),
        available: 'phase-3'
    },
    {
        id: 'V',
        name: 'Vladikavkaz Railway',
        color: '#7c7b8c',
        home: city('I19'),
        available: 'phase-3'
    }
]
export const MinorIds1861: readonly string[] = Minors1861.map(({ id }) => id)

// The eight public companies (§7.3).
export const Majors1861: readonly Major1861[] = [
    { id: 'GRR', name: 'Grand Russian Railway', color: '#ef4223' },
    { id: 'MK', name: 'Moscow & Kazan Railway', color: '#7b352a' },
    { id: 'MKV', name: 'Moscow, Kiev & Voronezh Railway', color: '#3c7b5c' },
    { id: 'MKN', name: 'Moscow, Kursk & Nizhnii Novgorod Railway', color: '#0189d1' },
    { id: 'MVR', name: 'Moscow, Vindava & Rybinsk Railway', color: '#808000' },
    { id: 'NW', name: 'North Western Railway', color: '#000080' },
    { id: 'SE', name: 'Southeastern Railway', color: '#772282' },
    { id: 'SW', name: 'Southwestern Railway', color: '#d75500' }
]
export const MajorIds1861: readonly string[] = Majors1861.map(({ id }) => id)

/** The Russian State Railway: no shares and no stock price (§7.4). */
export const RsrId = 'RSR'
export const RsrName = 'Russian State Railway'
export const RsrColor = '#fffdd0'
export const RsrTextColor = '#000000'
/** Eight stations, two of them kept for St. Petersburg and Moscow (§7.4, §11). */
export const RsrStationCount = 8
/** At most six RSR stations outside Moscow and St. Petersburg (§11). */
export const RsrOutsideStationLimit = 6

export function minor1861(companyId: string): Minor1861 | undefined {
    return Minors1861.find((minor) => minor.id === companyId)
}

export function major1861(companyId: string): Major1861 | undefined {
    return Majors1861.find((major) => major.id === companyId)
}

export function isMinor1861(companyId: string): boolean {
    return MinorIds1861.includes(companyId)
}

export function isMajor1861(companyId: string): boolean {
    return MajorIds1861.includes(companyId)
}

/**
 * A minor company is one 2-share certificate, so its stock price is half its value (§6, §7.2);
 * a public company has a 2-share director's certificate and eight 1-share certificates (§7.3).
 */
export const MinorShareCount = 2
export const MajorShareCount = 10

/** Each public company has three stations (§10.5). */
export const MajorStationCount = 3
/**
 * What a public company's second and third stations cost per hex from its nearest station on
 * the map, measured without regard to track (§10.5); stations placed at formation are free.
 */
export const StationCostPerHex1861: readonly number[] = [0, 20, 40]

/** The most a player may own of a public company: 60%, 70% in a two-player game (§7.3, GTG §16.1). */
export function ownershipLimitPercent1861(playerCount: number): number {
    return playerCount === 2 ? 70 : 60
}

export const Charters1861 = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...MinorIds1861.map((id) => [id, MinorShareCount]),
        ...MajorIds1861.map((id) => [id, MajorShareCount])
    ]),
    privateRevenues: Object.fromEntries(
        Privates1861.map((company) => [company.id, company.revenue])
    ),
    unsharedCompanyIds: [RsrId]
}))

const StartingCash: Readonly<Record<number, number>> = { 2: 420, 3: 420, 4: 315, 5: 252, 6: 210 }
const CertificateLimits: Readonly<Record<number, number>> = { 2: 21, 3: 21, 4: 16, 5: 13, 6: 11 }

/** Each player's starting capital (§3). */
export function startingCash1861(playerCount: number): number {
    const cash = StartingCash[playerCount]
    assertExists(cash, `1861 is for 2 to 6 players, not ${playerCount}`)
    return cash
}

/** The certificate limit (§9); a director's certificate counts as one certificate. */
export function certificateLimit1861(playerCount: number): number {
    const limit = CertificateLimits[playerCount]
    assertExists(limit, `1861 is for 2 to 6 players, not ${playerCount}`)
    return limit
}

/** The bank (§1). */
export const BankCash1861 = 15000
/** Each loan's value and the interest on it each operating round (§10.2). */
export const LoanValue1861 = 50
export const LoanInterest1861 = 5
/** Loans a company may hold: two for a minor, five for a public company, none for the RSR (§10.2). */
export const LoanLimits1861 = { minor: 2, major: 5 } as const
/** Minor auctions open at R100 at least and rise in R5 steps (§9.2). */
export const MinorOpeningBid = 100
export const BidIncrement1861 = 5
