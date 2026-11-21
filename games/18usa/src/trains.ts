import { PhaseTable, TrainDepot, type TrainDefinition } from '@tabletop/18xx'

export const PullmanTrainId = 'P'

const train = (id: string, price: number, rustsOn?: string): TrainDefinition => ({
    id,
    name: id,
    price,
    distance: { measure: 'revenue-centers', maximum: Number.parseInt(id) },
    ...(rustsOn ? { rustsOn } : {})
})

/** The 2-train P29 Bankrupt Railroad gives the company it starts in a "No subsidy" city. */
export const BankruptRailroadTrain = { id: 'P29:2', definitionId: '2' } as const

export const TrainVariantIds = {
    twoToFourPlayers: '18usa:2-4-players',
    seventeenRoster: '18usa:1817-trains'
} as const

// The 2-train supply is the bank's for the first operating round only; forty is more than
// the players' money can buy, and a finite count lets the rest be exported.
export const EighteenUSATrainDepot = new TrainDepot({
    id: '18usa',
    trains: [
        train('2', 100, '4'),
        train('2+', 100, '4'),
        train('3', 250, '6'),
        train('3+', 250, '6'),
        train('4', 400, '8'),
        train('4+', 400, '8'),
        train('5', 600),
        train('6', 750),
        train('7', 900),
        train('8', 1100),
        {
            id: PullmanTrainId,
            name: 'Pullman',
            price: 200,
            distance: { measure: 'revenue-centers', maximum: 1 },
            attachment: true
        }
    ],
    supply: [
        { definitionId: '2', count: 40 },
        { definitionId: '2+', count: 5 },
        { definitionId: '3', count: 12 },
        { definitionId: '3+', count: 2 },
        { definitionId: '4', count: 8 },
        { definitionId: '4+', count: 1 },
        { definitionId: '5', count: 6 },
        { definitionId: '6', count: 5 },
        { definitionId: '7', count: 3 },
        { definitionId: '8', count: 'unlimited' },
        { definitionId: PullmanTrainId, count: 'unlimited' }
    ],
    assignedTrains: [BankruptRailroadTrain],
    supplyVariants: {
        [TrainVariantIds.twoToFourPlayers]: { '2+': 4, '4': 7, '5': 5, '6': 4 },
        [TrainVariantIds.seventeenRoster]: { '2+': 4, '3+': 0, '4+': 0, '5': 5, '6': 4 }
    }
})

export type TrainRoster = 'standard' | '1817'

/** The depot variant for the player count and roster; five or more players use the full supply. */
export function trainSupplyVariant(playerCount: number, roster: TrainRoster): string | undefined {
    if (roster === '1817') return TrainVariantIds.seventeenRoster
    return playerCount < 5 ? TrainVariantIds.twoToFourPlayers : undefined
}

/** The + trains become obsolete, not rusted, when their type's rusting train arrives: each runs once more. */
export const ObsoleteTrainIds: readonly string[] = ['2+', '3+', '4+']

export const PullmanAvailablePhaseId = '5'
export const PullmanScrapValue = 50
export const PullmanStopBonus = 20

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']
export const EighteenUSAPhases = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 2, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 2, trainLimit: 3 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 2, trainLimit: 2 },
        { id: '7', startedBy: ['7'], tileColors: gray, operatingRounds: 2, trainLimit: 2 },
        { id: '8', startedBy: ['8'], tileColors: gray, operatingRounds: 2, trainLimit: 2 }
    ],
    EighteenUSATrainDepot
)

/** The share counts a company may be started with in each phase (§8). */
export const EighteenUSACompanySizes: Readonly<Record<string, readonly number[]>> = {
    '2': [2],
    '3': [2, 5],
    '4': [5],
    '5': [5, 10],
    '6': [10],
    '7': [10],
    '8': [10]
}
