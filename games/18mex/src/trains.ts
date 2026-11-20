import { PhaseTable, TrainDepot, type TrainInventory } from '@tabletop/18xx'

/** The minor companies' built-in 2-trains, printed on their charters, never bought or sold. */
export const MinorTrainId = 'minor-2'
export const FourDId = '4D'

const cities = (maximum: number) => ({ measure: 'cities-and-offboards', maximum }) as const

/**
 * The trains, bought from the Initial Offering in this order (Table I). Towns never count toward
 * a train's length (4.4.2(i)).
 */
export const TrainDepotMex = new TrainDepot({
    id: '18mex',
    trains: [
        { id: '2', name: '2', price: 100, distance: cities(2), rustsOn: '4' },
        { id: '3', name: '3', price: 180, distance: cities(3), rustsOn: '6' },
        { id: '4', name: '4', price: 300, distance: cities(4) },
        { id: '5', name: '5', price: 450, distance: cities(5) },
        { id: '6', name: '6', price: 600, distance: cities(6) },
        { id: FourDId, name: '4D', price: 700, distance: cities(4) },
        { id: MinorTrainId, name: '2', price: 0, distance: cities(2) }
    ],
    supply: [
        { definitionId: '2', count: 6 },
        { definitionId: '3', count: 6 },
        { definitionId: '4', count: 3 },
        { definitionId: '5', count: 2 },
        { definitionId: '6', count: 2 },
        { definitionId: FourDId, count: 7 },
        { definitionId: MinorTrainId, count: 3 }
    ]
})

/** A 4D-train doubles its cities and red areas, not its towns (4.4.2.1; Appendix 1). */
export function revenueMultiplier(definitionId: string): number {
    return definitionId === FourDId ? 2 : 1
}

export const ThreeHalfPhaseId = '3½'
export const SixHalfPhaseId = '6½'

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']

/** The phases of Table I; phase 1's game begins as phase 2, which changes nothing. */
export const PhasesMex = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 3 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        {
            id: ThreeHalfPhaseId,
            startedBy: [],
            tileColors: green,
            operatingRounds: 2,
            trainLimit: 3
        },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 2 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: SixHalfPhaseId, startedBy: [], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: FourDId, startedBy: [FourDId], tileColors: gray, operatingRounds: 3, trainLimit: 2 }
    ],
    TrainDepotMex
)

/**
 * The phase once the next train of the rank leaves the Initial Offering: the first of a rank
 * starts its phase, the fifth 3-train phase 3½ and the second 6-train phase 6½ (4.3.4(e)).
 */
export function phaseAfterPurchaseMex(
    state: { phaseId: string; trainInventory: TrainInventory },
    definitionId: string
): string {
    const remaining = TrainDepotMex.remaining(state.trainInventory, definitionId)
    const counted =
        (definitionId === '3' && remaining === 2 && ThreeHalfPhaseId) ||
        (definitionId === '6' && remaining === 1 && SixHalfPhaseId)
    if (counted) return PhasesMex.isAtLeast(state.phaseId, counted) ? state.phaseId : counted
    return PhasesMex.phaseAfterPurchase(state.phaseId, definitionId)
}
