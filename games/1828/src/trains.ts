import { PhaseTable, TrainDepot } from '@tabletop/18xx'

const centers = (maximum: number | 'unlimited') =>
    ({ measure: 'revenue-centers', maximum }) as const
const citiesAndOffboards = (maximum: number) =>
    ({ measure: 'cities-and-offboards', maximum }) as const

/** The Cobourg & Peterborough's own run, half of a 2-train route (§13.2.2.5); never sold. */
export const CobourgTrainId = 'CP2'

/** The purple train, and the phase it starts (table 4.1, §15.3.4). */
export const DieselTrainId = 'Diesel'

/** The game with three or four players has one red train fewer (§4). */
export const SmallTableSupply1828 = 'three-or-four'

/**
 * The train roster (table 4.1, §15.3). A 3+D counts three cities, coalfields or off-boards and
 * any number of towns, all doubled; an 8E counts eight of them and passes the towns unpaid.
 */
export const TrainDepot1828 = new TrainDepot({
    id: '1828',
    trains: [
        { id: '2', name: '2', price: 80, distance: centers(2), rustsOn: '5' },
        { id: '3', name: '3', price: 160, distance: centers(3), rustsOn: '6' },
        { id: '5', name: '5', price: 250, distance: centers(5), rustsOn: '8E' },
        {
            id: '3+D',
            name: '3+D',
            price: 350,
            distance: citiesAndOffboards(3),
            rustsOn: DieselTrainId
        },
        { id: '6', name: '6', price: 650, distance: centers(6) },
        { id: '8E', name: '8E', price: 800, distance: citiesAndOffboards(8) },
        { id: DieselTrainId, name: DieselTrainId, price: 900, distance: centers('unlimited') },
        { id: CobourgTrainId, name: 'C&P', price: 0, distance: centers(2) }
    ],
    supply: [
        { definitionId: '2', count: 6 },
        { definitionId: '3', count: 9 },
        { definitionId: '5', count: 4 },
        { definitionId: '3+D', count: 6 },
        { definitionId: '6', count: 4 },
        { definitionId: '8E', count: 3 },
        { definitionId: DieselTrainId, count: 'unlimited' },
        { definitionId: CobourgTrainId, count: 1 }
    ],
    supplyVariants: { [SmallTableSupply1828]: { '6': 3 } }
})

/** The double-revenue train (§15.3.2). */
export const DoubleTrainId = '3+D'
/** The express train, whose towns pay nothing (§15.3.3). */
export const ExpressTrainId = '8E'

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']

/**
 * The game phases, named by the train that starts them (table 4.1, §17): yellow 2, green 3, blue
 * 5, brown 3+D, red 6, gray 8E, purple Diesel.
 */
export const Phases1828 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '5', startedBy: ['5'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '3+D', startedBy: ['3+D'], tileColors: brown, operatingRounds: 3, trainLimit: 3 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '8E', startedBy: ['8E'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        {
            id: DieselTrainId,
            startedBy: [DieselTrainId],
            tileColors: brown,
            operatingRounds: 4,
            trainLimit: 2
        }
    ],
    TrainDepot1828
)

/** The trains a company, or each shell of a system, may hold in this phase (§15.4). */
export const phaseTrainLimit = (state: { phaseId: string }) =>
    Phases1828.phase(state.phaseId).trainLimit

/** The phases' colours, which name them in the rules (§17). */
export const PhaseColorNames1828: Readonly<Record<string, string>> = {
    '2': 'Yellow',
    '3': 'Green',
    '5': 'Blue',
    '3+D': 'Brown',
    '6': 'Red',
    '8E': 'Gray',
    [DieselTrainId]: 'Purple'
}

/** The phase whose start closes every private company (§17.5). */
export const PrivateClosurePhaseId = '6'
/** The phase in which directors' certificates can no longer be bought (§17.7). */
export const PurplePhaseId = DieselTrainId

/** Revenue centres with two values pay the second from brown phase (§17.4). */
export function revenueStage1828(phaseId: string): readonly string[] {
    return Phases1828.isAtLeast(phaseId, '3+D') ? ['brown'] : ['yellow']
}
