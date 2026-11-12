import { PhaseTable, TrainDepot, revenueStagesByPhase } from '@tabletop/18xx'

const hexEdges = (maximum: number) => ({ measure: 'hex-edges' as const, maximum })

export const CorporationCounts1849 = [5, 6] as const
export type CorporationCount1849 = (typeof CorporationCounts1849)[number]

// The train roster (§10.6). A five-corporation game removes one 6H, one 8H and one 16H (§2).
export const TrainCounts1849: Readonly<
    Record<CorporationCount1849, Readonly<Record<string, number>>>
> = {
    5: { '4H': 4, '6H': 3, '8H': 2, '10H': 2, '12H': 1, '16H': 4, R6H: 2 },
    6: { '4H': 4, '6H': 4, '8H': 3, '10H': 2, '12H': 1, '16H': 5, R6H: 2 }
}

export const FiveCorporationDepotId = '1849:five-corporations'

export function depotId1849(corporations: CorporationCount1849): string {
    return corporations === 5 ? FiveCorporationDepotId : TrainDepot1849.definition.id
}

/** Goes on sale once the first 16H is bought (§10.6). */
export const ReverseTrainId = 'R6H'

// A train counts the hex edges it crosses, a narrow gauge hex as two; the R6H reverses that,
// counting standard gauge hexes as two (§10.5.1).
export const TrainDepot1849 = new TrainDepot({
    id: '1849',
    trains: [
        { id: '4H', name: '4H', price: 100, distance: hexEdges(4), rustsOn: '8H' },
        { id: '6H', name: '6H', price: 200, distance: hexEdges(6), rustsOn: '10H' },
        { id: '8H', name: '8H', price: 350, distance: hexEdges(8), rustsOn: '16H' },
        { id: '10H', name: '10H', price: 550, distance: hexEdges(10) },
        { id: '12H', name: '12H', price: 800, distance: hexEdges(12) },
        { id: '16H', name: '16H', price: 1100, distance: hexEdges(16) },
        { id: ReverseTrainId, name: 'R6H', price: 350, distance: hexEdges(6) }
    ],
    supply: Object.entries(TrainCounts1849[6]).map(([definitionId, count]) => ({
        definitionId,
        count
    })),
    supplyVariants: {
        [FiveCorporationDepotId]: {
            '6H': TrainCounts1849[5]['6H'],
            '8H': TrainCounts1849[5]['8H'],
            '16H': TrainCounts1849[5]['16H']
        }
    }
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']

// The phases, named for the train that starts each (§6). The R6H starts none.
export const Phases1849 = new PhaseTable(
    [
        { id: '4H', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '6H', startedBy: ['6H'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '8H', startedBy: ['8H'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '10H', startedBy: ['10H'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '12H', startedBy: ['12H'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '16H', startedBy: ['16H'], tileColors: brown, operatingRounds: 3, trainLimit: 2 }
    ],
    TrainDepot1849
)

/** Closes the privates and sets off the Messina earthquake (§6, §12). */
export const EarthquakePhaseId = '12H'
/** Lets share prices enter the blue zone of the market (§5). */
export const BlueZonePhaseId = '16H'

// Grey values: the lowest in phases 4 and 6, the middle in 8 and 10, the highest after (§10.5.2).
export const revenueStages1849 = revenueStagesByPhase(Phases1849, 'low', [
    ['middle', '8H'],
    ['high', '12H']
])
