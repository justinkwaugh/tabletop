import { PhaseTable, TrainDepot, revenueStagesByPhase } from '@tabletop/18xx'

// An N-train counts at most N cities and off-board locations, towns paying only where it counts
// them; a 5+5E counts any five revenue centres; both 5+5E and 2+2 double the route (§8.8.1,
// §8.8.3).

const distance = (maximum: number) => ({ measure: 'cities-and-offboards' as const, maximum })

export const ExpressTrainId = '5+5E'
export const DoubleTwoTrainId = '2+2'

/**
 * The depot's supplies: unlimited 2+2 and 5+5E trains, the recommended option (§14), and the
 * two-player roster with fewer trains (§16.1.1).
 */
export const TrainSupply1867 = {
    unlimited: 'unlimited',
    twoPlayer: 'two-player',
    twoPlayerUnlimited: 'two-player-unlimited'
} as const

const TwoPlayerCounts = { '2': 7, '3': 5, '4': 3, '5': 3, '6': 1, '7': 1 }
const UnlimitedSpecialTrains = {
    [ExpressTrainId]: 'unlimited',
    [DoubleTwoTrainId]: 'unlimited'
} as const
/** The trains whose route value is doubled (§8.8.3). */
export const DoubledTrainIds1867: readonly string[] = [ExpressTrainId, DoubleTwoTrainId]
/** Trains that become available only in phase 8 (§11). */
export const PhaseEightTrainIds1867: readonly string[] = [ExpressTrainId, DoubleTwoTrainId]

// 2s rust on the first 4, 3s on the first 6 and 4s on the first 8 (§11).
export const TrainDepot1867 = new TrainDepot({
    id: '1867',
    trains: [
        { id: '2', name: '2', price: 100, distance: distance(2), rustsOn: '4' },
        { id: '3', name: '3', price: 225, distance: distance(3), rustsOn: '6' },
        { id: '4', name: '4', price: 350, distance: distance(4), rustsOn: '8' },
        { id: '5', name: '5', price: 550, distance: distance(5) },
        { id: '6', name: '6', price: 650, distance: distance(6) },
        { id: '7', name: '7', price: 800, distance: distance(7) },
        { id: '8', name: '8', price: 1000, distance: distance(8) },
        {
            id: ExpressTrainId,
            name: '5+5E',
            price: 1500,
            distance: { measure: 'cities-and-offboards', maximum: 'unlimited' }
        },
        { id: DoubleTwoTrainId, name: '2+2', price: 600, distance: distance(2) }
    ],
    supply: [
        { definitionId: '2', count: 10 },
        { definitionId: '3', count: 7 },
        { definitionId: '4', count: 4 },
        { definitionId: '5', count: 4 },
        { definitionId: '6', count: 2 },
        { definitionId: '7', count: 2 },
        { definitionId: '8', count: 'unlimited' },
        { definitionId: ExpressTrainId, count: 2 },
        { definitionId: DoubleTwoTrainId, count: 2 }
    ],
    // Two of each special train, or unlimited ones (§14).
    supplyVariants: {
        [TrainSupply1867.unlimited]: UnlimitedSpecialTrains,
        [TrainSupply1867.twoPlayer]: TwoPlayerCounts,
        [TrainSupply1867.twoPlayerUnlimited]: { ...TwoPlayerCounts, ...UnlimitedSpecialTrains }
    }
})

/** The train supply of the game's optional rules. */
export function trainSupply1867(
    unlimitedSpecialTrains: boolean,
    playerCount: number
): string | undefined {
    if (playerCount === 2)
        return unlimitedSpecialTrains
            ? TrainSupply1867.twoPlayerUnlimited
            : TrainSupply1867.twoPlayer
    return unlimitedSpecialTrains ? TrainSupply1867.unlimited : undefined
}

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']

/**
 * The train limit of each kind of company by phase (§11); the Canadian National has none.
 * Minor companies are gone from phase 8 and majors do not exist in phase 2.
 */
export const TrainLimits1867: Readonly<Record<string, { minor?: number; major?: number }>> = {
    '2': { minor: 2 },
    '3': { minor: 2, major: 4 },
    '4': { minor: 1, major: 3 },
    '5': { minor: 1, major: 3 },
    '6': { minor: 1, major: 2 },
    '7': { minor: 1, major: 2 },
    '8': { major: 2 }
}

// The phases, named after the train that starts each, with two operating rounds after every stock
// round (§6, §11). Green tiles from 3, brown from 5, grey from 7 (§11).
export const Phases1867 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 2, trainLimit: 2 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 2, trainLimit: 3 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 2, trainLimit: 2 },
        { id: '7', startedBy: ['7'], tileColors: gray, operatingRounds: 2, trainLimit: 2 },
        { id: '8', startedBy: ['8'], tileColors: gray, operatingRounds: 2, trainLimit: 2 }
    ],
    TrainDepot1867
)

/** Off-board values: the yellow in 2, the green in 3 and 4, the brown in 5 and 6, then the grey (§11). */
export const revenueStages1867 = revenueStagesByPhase(Phases1867, 'yellow', [
    ['green', '3'],
    ['brown', '5'],
    ['gray', '7']
])

/** Phases at the end of whose every operating round the CN exports a train: 4 to 7 (§8.13). */
export const TrainExportPhaseIds: readonly string[] = ['4', '5', '6', '7']
/** Phases after whose operating rounds a merger round follows: 3 to 7 (§6.3, §11). */
export const MergerRoundPhaseIds: readonly string[] = ['3', '4', '5', '6', '7']
/** Phases in which companies may buy private companies from players: 3 to 5 (§3.1, §11). */
export const PrivatePurchasePhaseIds: readonly string[] = ['3', '4', '5']
/** Major companies may be started by buying a President's certificate from phase 4 (§3.3, §11). */
export const MajorStartPhaseId = '4'
/** Minor companies may be auctioned before phase 5 (§7.2). */
export const MinorAuctionEndPhaseId = '5'
/** The six green minor companies become available in phase 3 (§3.2, §7.2). */
export const LaterMinorsPhaseId = '3'
/** Phases whose start nationalises trainless companies that have operated (§3.2, §11). */
export const TrainlessNationalisationPhaseIds: readonly string[] = ['4', '6', '8']
/** Private companies are nationalised at the start of phase 6 (§3.1, §11). */
export const PrivateNationalisationPhaseId = '6'
/** All minor companies are nationalised at the start of phase 8 (§3.2, §11). */
export const MinorNationalisationPhaseId = '8'
