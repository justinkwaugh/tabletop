import { assertExists } from '@tabletop/common'
import { companyCharters } from '@tabletop/18xx'
import { Privates1867 } from './privates.js'

export type Minor1867 = {
    id: string
    name: string
    color: string
    /** Available from the start, or only from phase 3 (§3.2, §7.2). */
    available: 'start' | 'phase-3'
}

export type Major1867 = {
    id: string
    name: string
    color: string
}

// The sixteen minor companies (§3.2): ten yellow from the start, six green from phase 3. They have
// no home on the map; a minor's station goes in the unoccupied city its auctioneer picks (§7.2.1).
export const Minors1867: readonly Minor1867[] = [
    { id: 'AE', name: 'Algoma Eastern Railway', color: '#689f38', available: 'start' },
    { id: 'BO', name: 'Brockville and Ottawa', color: '#009595', available: 'start' },
    { id: 'CA', name: 'Canada Atlantic Railway', color: '#b7274c', available: 'start' },
    { id: 'CS', name: 'Canada Southern', color: '#4cb5d2', available: 'start' },
    { id: 'CV', name: 'Credit Valley Railway', color: '#0097df', available: 'start' },
    { id: 'KP', name: 'Kingston and Pembroke', color: '#b0479a', available: 'start' },
    { id: 'NO', name: 'New York and Ottawa', color: '#7e57c2', available: 'start' },
    { id: 'OP', name: 'Ottawa and Prescott', color: '#d30869', available: 'start' },
    { id: 'PM', name: 'Pere Marquette Railway', color: '#455a64', available: 'start' },
    { id: 'TN', name: 'Toronto and Nipissing', color: '#f3716d', available: 'start' },
    {
        id: 'BBG',
        name: 'Buffalo, Brantford, and Goderich',
        color: '#7c7b8c',
        available: 'phase-3'
    },
    { id: 'LPS', name: 'London and Port Stanley', color: '#8d6e63', available: 'phase-3' },
    { id: 'QLS', name: 'Quebec and Lake St. John', color: '#1b5e20', available: 'phase-3' },
    { id: 'SLA', name: 'St. Lawrence and Atlantic', color: '#c49a00', available: 'phase-3' },
    { id: 'TGB', name: 'Toronto, Grey, and Bruce', color: '#5c6bc0', available: 'phase-3' },
    {
        id: 'THB',
        name: 'Toronto, Hamilton and Buffalo',
        color: '#2b2b2b',
        available: 'phase-3'
    }
]
export const MinorIds1867: readonly string[] = Minors1867.map(({ id }) => id)

// The eight major companies (§3.3).
export const Majors1867: readonly Major1867[] = [
    { id: 'CNR', name: 'Canadian Northern Railway', color: '#3c7b5c' },
    { id: 'CPR', name: 'Canadian Pacific Railway', color: '#ef4223' },
    { id: 'CO', name: 'Chesapeake and Ohio Railway', color: '#0189d1' },
    { id: 'GTR', name: 'Grand Trunk Railway', color: '#d75500' },
    { id: 'GWR', name: 'Great Western Railway', color: '#000080' },
    { id: 'ICR', name: 'Intercolonial Railway', color: '#7b352a' },
    { id: 'NTR', name: 'National Transcontinental Railway', color: '#808000' },
    { id: 'NYC', name: 'New York Central Railroad', color: '#772282' }
]
export const MajorIds1867: readonly string[] = Majors1867.map(({ id }) => id)

/** The Canadian National: no shares, no stock price and no treasury (§3.4, §8.13). */
export const CnId = 'CN'
export const CnName = 'Canadian National'
export const CnColor = '#fffdd0'
export const CnTextColor = '#000000'
/** Eight stations, one placed in Toronto at setup (§2.H, §10.1.E). */
export const CnStationCount = 8
/** At most six CN stations outside Toronto and Montreal, one being kept for Montreal (§8.13, §10.1.E). */
export const CnOutsideStationLimit = 6

export function minor1867(companyId: string): Minor1867 | undefined {
    return Minors1867.find((minor) => minor.id === companyId)
}

export function major1867(companyId: string): Major1867 | undefined {
    return Majors1867.find((major) => major.id === companyId)
}

export function isMinor1867(companyId: string): boolean {
    return MinorIds1867.includes(companyId)
}

/**
 * A minor company is one 2-share certificate (§3.2, §10.1.D); a major company has a 2-share
 * President's certificate and eight 1-share certificates (§3.3).
 */
export const MinorShareCount = 2
export const MajorShareCount = 10

/** Each major company has three stations (§8.7). */
export const MajorStationCount = 3
/**
 * What a major company's second and third stations cost per hex from its nearest station on the
 * map (§8.7); stations placed at formation are free.
 */
export const StationCostPerHex1867: readonly number[] = [0, 20, 40]

/** The most a player may own of a major company: 60%, 70% in a two-player game (§7.4.1, §16.1). */
export function ownershipLimitPercent1867(playerCount: number): number {
    return playerCount === 2 ? 70 : 60
}

export const Charters1867 = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...MinorIds1867.map((id) => [id, MinorShareCount]),
        ...MajorIds1867.map((id) => [id, MajorShareCount])
    ]),
    privateRevenues: Object.fromEntries(
        Privates1867.map((company) => [company.id, company.revenue])
    ),
    unsharedCompanyIds: [CnId]
}))

const StartingCash: Readonly<Record<number, number>> = { 2: 420, 3: 420, 4: 315, 5: 252, 6: 210 }
const CertificateLimits: Readonly<Record<number, number>> = { 2: 21, 3: 21, 4: 16, 5: 13, 6: 11 }

/** Each player's starting capital (§2). */
export function startingCash1867(playerCount: number): number {
    const cash = StartingCash[playerCount]
    assertExists(cash, `1867 is for 2 to 6 players, not ${playerCount}`)
    return cash
}

/** The certificate limit (§7.5); a President's certificate counts as one certificate. */
export function certificateLimit1867(playerCount: number): number {
    const limit = CertificateLimits[playerCount]
    assertExists(limit, `1867 is for 2 to 6 players, not ${playerCount}`)
    return limit
}

/** The bank (§2.K). */
export const BankCash1867 = 15000
/** Each loan's value and the interest on it each operating round (§8.2). */
export const LoanValue1867 = 50
export const LoanInterest1867 = 5
/** Loans a company may hold: two for a minor, five for a major; the CN takes none (§8.2, §8.13). */
export const LoanLimits1867 = { minor: 2, major: 5 } as const
/** Minor auctions open at $100 at least and rise in $5 steps (§7.2.1). */
export const MinorOpeningBid = 100
export const BidIncrement1867 = 5
