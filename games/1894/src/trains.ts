import { PhaseTable, TrainDepot } from '@tabletop/18xx'

const revenueCenters = (maximum: number | 'unlimited', extraTowns?: number) => ({
    measure: 'revenue-centers' as const,
    maximum,
    ...(extraTowns ? { extraTowns } : {})
})

// The train table (§13.2, §22.2): purple diesels are unlimited.
export const EighteenNinetyFourTrainDepot = new TrainDepot({
    id: '1894',
    trains: [
        { id: '2', name: '2', price: 80, distance: revenueCenters(2), rustsOn: '4' },
        { id: '3', name: '3', price: 120, distance: revenueCenters(3), rustsOn: '5+1' },
        { id: '4', name: '4', price: 300, distance: revenueCenters(4), rustsOn: '7' },
        { id: '5+1', name: '5+1', price: 400, distance: revenueCenters(5, 1), rustsOn: 'D' },
        { id: '6', name: '6', price: 600, distance: revenueCenters(6) },
        { id: '7', name: '7', price: 700, distance: revenueCenters(7) },
        { id: 'D', name: 'D', price: 800, distance: revenueCenters('unlimited') }
    ],
    supply: [
        { definitionId: '2', count: 7 },
        { definitionId: '3', count: 5 },
        { definitionId: '4', count: 4 },
        { definitionId: '5+1', count: 5 },
        { definitionId: '6', count: 2 },
        { definitionId: '7', count: 3 },
        { definitionId: 'D', count: 'unlimited' }
    ]
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
// Each train starts the phase named for it; the rulebook calls them by the trains' colours, from
// yellow through green, blue, brown, red and gray to purple (§15).
export const EighteenNinetyFourPhases = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5+1', startedBy: ['5+1'], tileColors: brown, operatingRounds: 3, trainLimit: 3 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 3 },
        { id: '7', startedBy: ['7'], tileColors: brown, operatingRounds: 3, trainLimit: 3 },
        { id: 'D', startedBy: ['D'], tileColors: brown, operatingRounds: 3, trainLimit: 2 }
    ],
    EighteenNinetyFourTrainDepot
)

/** Each train's colour, which train upgrades step through (§7.3.7.2, §13.1). */
export const TrainColorOrder: readonly string[] = ['2', '3', '4', '5+1', '6', '7', 'D']
