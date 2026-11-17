import { assertExists } from '@tabletop/common'
import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import { PrivateNationalisationPhaseId, Phases1867 } from './trains.js'

export const ChamplainStLawrencePrivateId = 'CSL'
export const NiagaraFallsBridgePrivateId = 'NFB'
export const MontrealBridgePrivateId = 'MB'
export const QuebecBridgePrivateId = 'QB'
export const StClairTunnelPrivateId = 'SCT'

/**
 * What the private companies print beyond face value and income (§3.1): the lowest opening bid,
 * and the city or off-board location whose value rises by $10 for each train of an owning
 * company that runs to it.
 */
export type PrivateTerms1867 = {
    minimumBid: number
    bonusLocationIds: readonly string[]
    bonus: number
}

const Buffalo = 'F18'
const Montreal = 'L12'
const Quebec = 'O7'
const Detroit = ['A17', 'A19']

export const PrivateTerms1867: Readonly<Record<string, PrivateTerms1867>> = {
    [ChamplainStLawrencePrivateId]: { minimumBid: 20, bonusLocationIds: [], bonus: 0 },
    [NiagaraFallsBridgePrivateId]: {
        minimumBid: 30,
        bonusLocationIds: [Buffalo],
        bonus: 10
    },
    [MontrealBridgePrivateId]: {
        minimumBid: 40,
        bonusLocationIds: [Montreal],
        bonus: 10
    },
    [QuebecBridgePrivateId]: { minimumBid: 50, bonusLocationIds: [Quebec], bonus: 10 },
    [StClairTunnelPrivateId]: { minimumBid: 60, bonusLocationIds: Detroit, bonus: 10 }
}

export function privateTerms1867(privateCompanyId: string): PrivateTerms1867 {
    const terms = PrivateTerms1867[privateCompanyId]
    assertExists(terms, `Unknown 1867 private ${privateCompanyId}`)
    return terms
}

const nationalised =
    'Nationalised at the start of phase 6: its owner receives its face value and the Canadian National takes it.'
const bonus = (where: string) =>
    `A company that owns it adds $10 to ${where} for each of its trains that runs there.`

// The five private companies, auctioned in ascending face value (§3.1, §5.1). Companies may buy
// them from players in phases 3 to 5 for $1 up to face value (§3.1); a company never sells one.
// They do not close: phase 6 nationalises them (§3.1, §11), a title rule rather than a closure.
export const PrivateCatalog1867 = new PrivateCatalog(
    {
        closurePhaseId: PrivateNationalisationPhaseId,
        privates: [
            {
                id: ChamplainStLawrencePrivateId,
                name: 'Champlain & St. Lawrence',
                faceValue: 30,
                revenue: 10,
                closure: 'never',
                sale: { minimum: 1, maximum: 30 },
                description: `No special abilities. ${nationalised}`
            },
            {
                id: NiagaraFallsBridgePrivateId,
                name: 'Niagara Falls Bridge',
                faceValue: 45,
                revenue: 15,
                closure: 'never',
                sale: { minimum: 1, maximum: 45 },
                description: `${bonus(place(Buffalo))} ${nationalised}`
            },
            {
                id: MontrealBridgePrivateId,
                name: 'Montreal Bridge',
                faceValue: 60,
                revenue: 20,
                closure: 'never',
                sale: { minimum: 1, maximum: 60 },
                description: `${bonus(place(Montreal))} ${nationalised}`
            },
            {
                id: QuebecBridgePrivateId,
                name: 'Quebec Bridge',
                faceValue: 75,
                revenue: 25,
                closure: 'never',
                sale: { minimum: 1, maximum: 75 },
                description: `${bonus(place(Quebec))} ${nationalised}`
            },
            {
                id: StClairTunnelPrivateId,
                name: 'St. Clair Tunnel',
                faceValue: 90,
                revenue: 30,
                closure: 'never',
                sale: { minimum: 1, maximum: 90 },
                description: `${bonus(place('A19'))} ${nationalised}`
            }
        ]
    },
    Phases1867
)
export const Privates1867 = PrivateCatalog1867.privates
export const PrivateIds1867: readonly string[] = Privates1867.map(({ id }) => id)
