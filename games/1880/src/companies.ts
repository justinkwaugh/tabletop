import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import {
    BcrId,
    BzuId,
    CkrId,
    HkrId,
    JggId,
    JhaId,
    JhuId,
    JlrId,
    LhrId,
    NjrId,
    NxrId,
    P0Id,
    P1Id,
    P2Id,
    P3Id,
    P4Id,
    P5Id,
    P6Id,
    P7Id,
    QsrId,
    ScrId,
    WnrId
} from './ids.js'
import { InvestorHomes1880, TaiwanLocationId } from './map.js'
import { CommunistPhaseId, Phases1880 } from './trains.js'

export * from './ids.js'

/**
 * The major companies in the turn order list's order (§VIII); each has its home station and two
 * more, the first ¥40 and the second ¥100 (§X Placing station markers).
 */
export const Majors1880 = [
    { id: JhaId, name: 'Jingha Railway' },
    { id: JhuId, name: 'Jinghu Railway' },
    { id: JggId, name: 'Jingguang Railway' },
    { id: JlrId, name: 'Jinglan Railway' },
    { id: BzuId, name: 'Binzhou Railway' },
    { id: LhrId, name: 'Longhai Railway' },
    { id: ScrId, name: 'Schichang Railway' },
    { id: CkrId, name: 'Chengkun Railway' },
    { id: BcrId, name: 'Baocheng Railway' },
    { id: NxrId, name: 'Ningxi Railway' },
    { id: HkrId, name: 'Hukun Railway' },
    { id: NjrId, name: 'Nanjiang Railway' },
    { id: QsrId, name: 'Qinshen Railway' },
    { id: WnrId, name: 'Wunan Railway' }
] as const satisfies readonly { id: string; name: string }[]
export type MajorId1880 = (typeof Majors1880)[number]['id']

/** Station costs: home free, then ¥40 and ¥100, doubled from phase D (§X). */
export const StationCosts1880: readonly number[] = [0, 40, 100]

/** The foreign investors and their home bases (§VII). */
export const ForeignInvestors1880 = [
    { id: 'A1', name: 'Russian Investor', home: InvestorHomes1880.A1 },
    { id: 'A2', name: 'Japanese Investor', home: InvestorHomes1880.A2 },
    { id: 'A3', name: 'Belgian Investor', home: InvestorHomes1880.A3 },
    { id: 'A4', name: 'German Investor', home: InvestorHomes1880.A4 },
    { id: 'A5', name: 'British Investor', home: InvestorHomes1880.A5 },
    { id: 'A6', name: 'Portuguese Investor', home: InvestorHomes1880.A6 },
    { id: 'A7', name: 'French Investor', home: InvestorHomes1880.A7 }
] as const satisfies readonly { id: string; name: string; home: string }[]

/** P0's one-off payment by the train whose last purchase earns it (§VI). */
export const P0Payments: readonly { definitionId: string; amount: number }[] = [
    { definitionId: '2+2', amount: 40 },
    { definitionId: '3', amount: 70 },
    { definitionId: '3+3', amount: 100 }
]

/** Privates keep their powers to the end, but pay nothing from the Communist Takeover (§VI, §XIV). */
const survives = { survivesWhilePlayerOwned: { revenue: 0 } } as const

export const PrivateCatalog1880 = new PrivateCatalog(
    {
        closurePhaseId: CommunistPhaseId,
        privates: [
            {
                id: P0Id,
                name: 'Woosong Railway',
                faceValue: 5,
                revenue: 0,
                closure: survives,
                sale: 'never',
                description:
                    'Its owner receives once ¥40 when the last 2+2-train leaves the bank, or ¥70 for the last 3-train, or ¥100 for the last 3+3-train, which comes automatically if neither earlier payment was taken.'
            },
            {
                id: P1Id,
                name: 'Kaiping Railway',
                faceValue: 10,
                revenue: 5,
                closure: survives,
                sale: 'never',
                description: 'No special power.'
            },
            {
                id: P2Id,
                name: 'Yanda Ferry Company',
                faceValue: 25,
                revenue: 10,
                closure: survives,
                sale: 'never',
                description: 'All its owner’s companies use the ferries without the ¥10 fee.'
            },
            {
                id: P3Id,
                name: 'Taiwan Western Line',
                faceValue: 45,
                revenue: 15,
                closure: survives,
                sale: 'never',
                description: `${place(TaiwanLocationId)} is worth ¥20 more to all its owner’s companies.`
            },
            {
                id: P4Id,
                name: 'Chinese Rivers Ferry Companies',
                faceValue: 70,
                revenue: 20,
                closure: survives,
                sale: 'never',
                description:
                    'Building in a river hex costs its owner’s companies ¥20 less, nothing in a river hex alone.'
            },
            {
                id: P5Id,
                name: 'Jeme Tien Yow Engineer Office',
                faceValue: 100,
                revenue: 25,
                closure: survives,
                sale: 'never',
                description:
                    'An extra building permit for phase D, which its owner assigns at any time to one of their major companies.'
            },
            {
                id: P6Id,
                name: 'Imperial Qing Government',
                faceValue: 160,
                revenue: 0,
                closure: survives,
                sale: 'never',
                description:
                    'Comes with the BCR’s 20% director’s certificate, its price set at ¥100; the BCR may always lay two yellow tiles. Closes once the BCR is under way.'
            },
            {
                id: P7Id,
                name: 'Rocket of China',
                faceValue: 50,
                revenue: 0,
                closure: survives,
                sale: 'never',
                description:
                    'In one of its owner’s major companies’ turns, exchange it for the train on sale, free. With the first 4-train it is exchanged for the second.'
            }
        ]
    },
    Phases1880
)
export const Privates1880 = PrivateCatalog1880.privates
