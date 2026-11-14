import { PhaseTable, TrainDepot, revenueStagesByPhase } from '@tabletop/18xx'
import { Scenarios1822, StandardSetup1822 } from './scenarios.js'

// A numbered train reaches that many stations, towns counting (§5.5.4).
const stations = (maximum: number) => ({ measure: 'revenue-centers' as const, maximum })

// An L train runs in a city holding its company's station, and may run on to one small station
// (§5.5.3).
const local = {
    measure: 'revenue-centers' as const,
    maximum: 1,
    extraTowns: 1,
    stationRun: true as const
}

export const LocalTrainId = 'L'
const Standard = StandardSetup1822.trains
export const ElectricTrainId = 'E'
/** The permanent 2-train of private companies P3 and P4 (§5.5.13). */
export const PermanentTwoTrainId = '2P'
/** The 1822+ permanent L train of private company P19 (§5.5.13). */
export const PermanentLocalTrainId = 'LP'
/** The trains that come with a private company for good, whose revenue may be decided apart (§5.14.2). */
export const PermanentTrainIds: readonly string[] = [PermanentTwoTrainId, PermanentLocalTrainId]
/** The Pullman carriage of private companies P13 and P14 (§5.5.6, §5.5.14). */
export const PullmanTrainId = 'P+'

/** The trains that come with private companies, by the private's id (§3.1.18). */
export const PrivateTrains1822: Readonly<Record<string, { id: string; definitionId: string }>> = {
    P1: { id: 'P1:5', definitionId: '5' },
    P3: { id: 'P3:2P', definitionId: PermanentTwoTrainId },
    P4: { id: 'P4:2P', definitionId: PermanentTwoTrainId },
    P13: { id: 'P13:P+', definitionId: PullmanTrainId },
    P14: { id: 'P14:P+', definitionId: PullmanTrainId },
    P19: { id: 'P19:LP', definitionId: PermanentLocalTrainId }
}

/**
 * Trains that count neither against the train limit nor as the train a company must own, and are
 * never sold between companies (§5.5.13, §5.5.14).
 */
export const ExtraTrainIds1822: readonly string[] = [
    PermanentTwoTrainId,
    PermanentLocalTrainId,
    PullmanTrainId
]

// The rolling stock (§5.5, Table 7). L and 2 are the two sides of one card, as are 7 and E
// (§5.5.7, §5.5.8). An E train stops only at its company's stations and runs on track other
// trains use (§5.5.8, §5.5.11).
export const TrainDepot1822 = new TrainDepot({
    id: '1822',
    trains: [
        { id: LocalTrainId, name: 'L', price: 60, distance: local, rustsOn: '3' },
        { id: '2', name: '2', price: 120, distance: stations(2), rustsOn: '4' },
        { id: '3', name: '3', price: 200, distance: stations(3), rustsOn: '6' },
        { id: '4', name: '4', price: 300, distance: stations(4), rustsOn: '7' },
        { id: '5', name: '5', price: 500, distance: stations(5) },
        { id: '6', name: '6', price: 600, distance: stations(6) },
        { id: '7', name: '7', price: 750, distance: stations(7) },
        {
            id: ElectricTrainId,
            name: 'E',
            price: 1000,
            distance: { measure: 'revenue-centers', maximum: 'unlimited' },
            sharesTrack: true
        },
        { id: PermanentTwoTrainId, name: '2P', price: 0, distance: stations(2) },
        { id: PermanentLocalTrainId, name: 'LP', price: 0, distance: local },
        { id: PullmanTrainId, name: 'P+', price: 0, distance: stations(1), attachment: true }
    ],
    supply: [
        { definitionId: LocalTrainId, variantDefinitionIds: ['2'], count: Standard[LocalTrainId] },
        ...['3', '4', '5', '6'].map((definitionId) => ({
            definitionId,
            count: Standard[definitionId]
        })),
        { definitionId: '7', variantDefinitionIds: [ElectricTrainId], count: 'unlimited' }
    ],
    // Each scenario's bank holds fewer trains (§6.2.1; scenario pack, Train Mix sheet).
    supplyVariants: Object.fromEntries(
        Scenarios1822.map((scenario) => [scenario.id, scenario.trains])
    ),
    assignedTrains: Object.values(PrivateTrains1822)
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const grey = ['yellow', 'green', 'brown', 'gray']

// The seven phases (§2.2, Table 2); the train limit is a major company's. Phase 2 starts with
// the first 2-train, bought or flipped from an L, and a later train bought first starts its own
// phase (§2.3).
export const Phases1822 = new PhaseTable(
    [
        { id: '1', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '2', startedBy: ['2'], tileColors: yellow, operatingRounds: 2, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 2, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 2, trainLimit: 2 },
        {
            id: '7',
            startedBy: ['7', ElectricTrainId],
            tileColors: grey,
            operatingRounds: 2,
            trainLimit: 2
        }
    ],
    TrainDepot1822
)

/** A minor company's train limit by phase (Table 2). */
export const MinorTrainLimits1822: Readonly<Record<string, number>> = {
    '1': 2,
    '2': 2,
    '3': 2,
    '4': 1,
    '5': 1,
    '6': 1,
    '7': 1
}

/** The values a grey area prints, by the tile colour of the phase (§5.4.5). */
export const RevenueStages1822 = ['yellow', 'green', 'brown', 'gray'] as const

// Grey areas pay their yellow value in phases 1 and 2, green in 3 and 4, brown in 5 and 6 and
// grey in phase 7 (§5.4.5).
export const revenueStages1822 = revenueStagesByPhase(Phases1822, 'yellow', [
    ['green', '3'],
    ['brown', '5'],
    ['gray', '7']
])
