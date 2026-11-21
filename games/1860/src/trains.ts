import { PhaseTable, TrainDepot, type TrainDefinition } from '@tabletop/18xx'

/**
 * An M+N train: up to M large stations, and N small stations or halts besides, with any unused
 * large-station allowance free for small stations and halts too (Running Trains).
 */
const train = (
    id: string,
    price: number,
    largeStations: number,
    smallStations: number,
    rustsOn?: string
): TrainDefinition => ({
    id,
    name: id,
    price,
    distance: { measure: 'revenue-centers', maximum: largeStations, extraTowns: smallStations },
    ...(rustsOn ? { rustsOn } : {})
})

export const SouthernTrainId = '9+5'
/** The first 8+4 lifts the certificate limit and stops sales moving prices (Phase 8). */
export const NoCertificateLimitPhaseId = '8'
/** The first 6+3 puts the Fishbourne Ferry Company up for sale (Phase 6). */
export const FishbournePhaseId = '6'

/** The trains, sold in this order (Phases); there are as many 9+5s as are wanted. */
export const TrainDepot1860 = new TrainDepot({
    id: '1860',
    trains: [
        train('2+1', 250, 2, 1, '4+2'),
        train('3+2', 300, 3, 2, '6+3'),
        train('4+2', 350, 4, 2, '7+4'),
        train('5+3', 400, 5, 3, '8+4'),
        train('6+3', 500, 6, 3),
        train('7+4', 600, 7, 4),
        train('8+4', 700, 8, 4),
        train('9+5', 800, 9, 5)
    ],
    supply: [
        { definitionId: '2+1', count: 5 },
        { definitionId: '3+2', count: 4 },
        { definitionId: '4+2', count: 3 },
        { definitionId: '5+3', count: 2 },
        { definitionId: '6+3', count: 2 },
        { definitionId: '7+4', count: 1 },
        { definitionId: '8+4', count: 1 },
        { definitionId: '9+5', count: 'unlimited' }
    ],
    // Players new to the game may play with two 7+4 trains (Phases).
    supplyVariants: { '1860:two-7+4': { '7+4': 2 } }
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const russet = ['yellow', 'green', 'brown']

/** The phases, each started by the first train of its kind (Phases). */
export const Phases1860 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3+2'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4+2'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5+3'], tileColors: russet, operatingRounds: 3, trainLimit: 3 },
        { id: '6', startedBy: ['6+3'], tileColors: russet, operatingRounds: 3, trainLimit: 2 },
        { id: '7', startedBy: ['7+4'], tileColors: russet, operatingRounds: 3, trainLimit: 2 },
        { id: '8', startedBy: ['8+4'], tileColors: russet, operatingRounds: 3, trainLimit: 2 },
        { id: '9', startedBy: ['9+5'], tileColors: russet, operatingRounds: 3, trainLimit: 2 }
    ],
    TrainDepot1860
)

/** A train's large-station allowance, the M of its M+N. */
export function largeStationAllowance(definitionId: string): number {
    const { maximum } = TrainDepot1860.trainDefinition(definitionId).distance
    return maximum === 'unlimited' ? 0 : maximum
}
