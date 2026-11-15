import { assertExists } from '@tabletop/common'
import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import { Phases1861 } from './trains.js'

export const TsarskoyeSeloPrivateId = 'TSR'
export const BlackSeaPrivateId = 'BSS'
export const MoscowYaroslavlPrivateId = 'MYR'
export const MoscowRyazanPrivateId = 'MRR'
export const WarsawViennaPrivateId = 'WVR'

/**
 * What the private companies print beyond face value and income (Table 1): the lowest opening
 * bid, and the city or red area whose value rises by R10 for each train of an owning company
 * that runs to it (§7.1).
 */
export type PrivateTerms1861 = {
    minimumBid: number
    bonusLocationIds: readonly string[]
    bonus: number
}

const Poland = ['A9', 'A11', 'A13', 'A15']

export const PrivateTerms1861: Readonly<Record<string, PrivateTerms1861>> = {
    [TsarskoyeSeloPrivateId]: { minimumBid: 20, bonusLocationIds: [], bonus: 0 },
    [BlackSeaPrivateId]: { minimumBid: 30, bonusLocationIds: ['D20'], bonus: 10 },
    [MoscowYaroslavlPrivateId]: { minimumBid: 40, bonusLocationIds: ['H8'], bonus: 10 },
    [MoscowRyazanPrivateId]: { minimumBid: 50, bonusLocationIds: ['H8'], bonus: 10 },
    [WarsawViennaPrivateId]: { minimumBid: 60, bonusLocationIds: Poland, bonus: 10 }
}

export function privateTerms1861(privateCompanyId: string): PrivateTerms1861 {
    const terms = PrivateTerms1861[privateCompanyId]
    assertExists(terms, `Unknown 1861 private ${privateCompanyId}`)
    return terms
}

const nationalised =
    'Nationalised at the start of phase 6: its owner receives its face value and the Russian State Railway takes it.'
const bonus = (where: string) =>
    `A company that owns it adds ₽10 to ${where} for each of its trains that runs there.`

// The five private companies, auctioned in this order (Table 1, §9.4). Companies may buy them from
// players in phases 3 to 5 for R1 up to face value (§7.1); a company never sells one. They do not
// close: phase 6 nationalises them (§11), a title rule rather than a closure.
export const PrivateCatalog1861 = new PrivateCatalog(
    {
        closurePhaseId: '6',
        privates: [
            {
                id: TsarskoyeSeloPrivateId,
                name: 'Tsarskoye Selo Railway',
                faceValue: 30,
                revenue: 10,
                closure: 'never',
                sale: { minimum: 1, maximum: 30 },
                description: `No special abilities. ${nationalised}`
            },
            {
                id: BlackSeaPrivateId,
                name: 'Black Sea Shipping Company',
                faceValue: 45,
                revenue: 15,
                closure: 'never',
                sale: { minimum: 1, maximum: 45 },
                description: `${bonus(place('D20'))} ${nationalised}`
            },
            {
                id: MoscowYaroslavlPrivateId,
                name: 'Moscow–Yaroslavl Railway',
                faceValue: 60,
                revenue: 20,
                closure: 'never',
                sale: { minimum: 1, maximum: 60 },
                description: `${bonus(place('H8'))} ${nationalised}`
            },
            {
                id: MoscowRyazanPrivateId,
                name: 'Moscow–Ryazan Railway',
                faceValue: 75,
                revenue: 25,
                closure: 'never',
                sale: { minimum: 1, maximum: 75 },
                description: `${bonus(place('H8'))} ${nationalised}`
            },
            {
                id: WarsawViennaPrivateId,
                name: 'Warsaw–Vienna Railway',
                faceValue: 90,
                revenue: 30,
                closure: 'never',
                sale: { minimum: 1, maximum: 90 },
                description: `${bonus(place('A9'))} ${nationalised}`
            }
        ]
    },
    Phases1861
)
export const Privates1861 = PrivateCatalog1861.privates
export const PrivateIds1861: readonly string[] = Privates1861.map(({ id }) => id)
