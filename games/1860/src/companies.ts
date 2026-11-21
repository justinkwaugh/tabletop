import { PrivateCatalog, companyCharters } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { Phases1860 } from './trains.js'

export const CnId = 'CN'
export const IowId = 'IOW'
export const IwnjId = 'IWNJ'
export const FynId = 'FYN'
export const NgstlId = 'NGStL'
export const BhirId = 'BHIR'
export const ScId = 'SC'
export const VyscId = 'VYSC'

export const BradingId = 'BHC'
export const YarmouthId = 'YHC'
export const CowesId = 'CMH'
export const RydePierId = 'RPSC'
export const FishbourneId = 'FFC'

export type Layer = 1 | 2 | 3 | 4

export type Company1860 = {
    id: string
    name: string
    initials: string
    /** The layer that makes the company available to start (Major Companies). */
    layer: Layer
    /** The home hex, where its home base stands. */
    home: string
    /** The cost of each base on its charter, the free home base first (Building Bases). */
    stationCosts: readonly number[]
    /** The private exchanged for the share kept at the bottom of its IPO pile, if any. */
    exchangePrivateId?: string
}

const bases = (count: number) => [0, 40, 100, 100].slice(0, count)

/** The eight companies, by layer (Major Companies). */
export const Companies1860: readonly Company1860[] = [
    {
        id: CnId,
        name: 'Cowes & Newport',
        initials: 'C&N',
        layer: 1,
        home: 'F2',
        stationCosts: bases(4),
        exchangePrivateId: CowesId
    },
    {
        id: IowId,
        name: 'Isle of Wight',
        initials: 'IOW',
        layer: 1,
        home: 'I3',
        stationCosts: bases(4),
        exchangePrivateId: RydePierId
    },
    {
        id: IwnjId,
        name: 'Isle of Wight, Newport Junction',
        initials: 'IWNJ',
        layer: 2,
        home: 'G7',
        stationCosts: bases(3)
    },
    {
        id: FynId,
        name: 'Freshwater, Yarmouth & Newport',
        initials: 'FYN',
        layer: 2,
        home: 'B4',
        stationCosts: bases(3),
        exchangePrivateId: YarmouthId
    },
    {
        id: NgstlId,
        name: 'Newport, Godshill & St. Lawrence',
        initials: 'NGStL',
        layer: 3,
        home: 'G9',
        stationCosts: bases(2)
    },
    {
        id: BhirId,
        name: 'Brading Harbour Improvement & Railway',
        initials: 'BHI&R',
        layer: 3,
        home: 'L6',
        stationCosts: bases(2),
        exchangePrivateId: BradingId
    },
    {
        id: ScId,
        name: 'Shanklin & Chale',
        initials: 'S&C',
        layer: 4,
        home: 'F12',
        stationCosts: bases(2)
    },
    {
        id: VyscId,
        name: 'Ventnor, Yarmouth & South Coast',
        initials: 'VY&SC',
        layer: 4,
        home: 'E9',
        stationCosts: bases(2)
    }
]
export const CompanyIds1860: readonly string[] = Companies1860.map((company) => company.id)

export function company1860(companyId: string): Company1860 {
    const company = Companies1860.find((entry) => entry.id === companyId)
    assertExists(company, `Unknown 1860 company ${companyId}`)
    return company
}

export function isCompany1860(companyId: string): boolean {
    return CompanyIds1860.includes(companyId)
}

/** The par prices a layer's companies choose from (Major Companies). */
export const LayerParRanges: Readonly<Record<Layer, { minimum: number; maximum: number }>> = {
    1: { minimum: 74, maximum: 100 },
    2: { minimum: 62, maximum: 82 },
    3: { minimum: 58, maximum: 68 },
    4: { minimum: 54, maximum: 62 }
}

/** A bankrupt company is started again at a par of at least 40 (Bankrupt Companies). */
export const RefloatMinimumPar = 40

/** Every share is 10%, the director's certificate two of them. */
export const ShareCount = 10
export const DirectorShares = 2

/**
 * The privates: four ferry companies sold in the initial auction, each exchanged for its
 * company's reserved share; the Fishbourne Ferry, for sale from the first 6+3 train, closes the
 * others when bought. None closes with a phase.
 */
export const PrivateCatalog1860 = new PrivateCatalog(
    {
        closurePhaseId: '9',
        privates: [
            {
                id: BradingId,
                name: 'Brading Harbour Company',
                faceValue: 30,
                revenue: 5,
                closure: 'never',
                sale: 'never',
                description:
                    'Its owner may exchange it for the reserved BHI&R share in their stock turn, once the BHI&R has a par. Closes on the exchange, or when the Fishbourne Ferry is bought.'
            },
            {
                id: YarmouthId,
                name: 'Yarmouth Harbour Company',
                faceValue: 50,
                revenue: 10,
                closure: 'never',
                sale: 'never',
                description:
                    'Its owner may exchange it for the reserved FYN share in their stock turn, once the FYN has a par. Closes on the exchange, or when the Fishbourne Ferry is bought.'
            },
            {
                id: CowesId,
                name: 'Cowes Marina and Harbour',
                faceValue: 90,
                revenue: 20,
                closure: 'never',
                sale: 'never',
                description:
                    'Its owner may exchange it for the reserved C&N share in their stock turn, once the C&N has a par. Closes on the exchange, or when the Fishbourne Ferry is bought.'
            },
            {
                id: RydePierId,
                name: 'Ryde Pier & Shipping Company',
                faceValue: 130,
                revenue: 30,
                closure: 'never',
                sale: 'never',
                description:
                    'Its owner may exchange it for the reserved IOW share in their stock turn, once the IOW has a par. Closes on the exchange, or when the Fishbourne Ferry is bought.'
            },
            {
                id: FishbourneId,
                name: 'Fishbourne Ferry Company',
                faceValue: 200,
                revenue: 25,
                closure: 'never',
                sale: 'never',
                description:
                    'The bank sells it at face value from the first 6+3 train. Buying it closes every other private.'
            }
        ]
    },
    Phases1860
)
export const PrivateIds1860: readonly string[] = PrivateCatalog1860.privates.map(
    (company) => company.id
)
/** The four privates of the initial auction, cheapest first. */
export const FerryPrivateIds: readonly string[] = [BradingId, YarmouthId, CowesId, RydePierId]

/** The privates sell to the bank for their face value less £30 (Selling Private Companies). */
export const PrivateSaleCommission = 30

export const Charters1860 = companyCharters(() => ({
    shareCounts: Object.fromEntries(CompanyIds1860.map((id) => [id, ShareCount])),
    privateRevenues: Object.fromEntries(
        PrivateCatalog1860.privates.map((company) => [company.id, company.revenue])
    )
}))

/** The company whose reserved share the private is exchanged for. */
export function exchangeCompanyId(privateCompanyId: string): string | undefined {
    return Companies1860.find((company) => company.exchangePrivateId === privateCompanyId)?.id
}
