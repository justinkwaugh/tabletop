import { PhaseTable, TrainDepot, type TrainRules } from '@tabletop/18xx'

const train = (id: string, price: number, rustsOn?: string) => ({
    id,
    name: id,
    price,
    distance: { measure: 'revenue-centers' as const, maximum: Number.parseInt(id) },
    ...(rustsOn ? { rustsOn } : {})
})

export const EighteenSeventeenTrainDepot = new TrainDepot({
    id: '1817',
    trains: [
        train('2', 100, '4'),
        train('2+', 100, '4'),
        train('3', 250, '6'),
        train('4', 400, '8'),
        train('5', 600),
        train('6', 750),
        train('7', 900),
        train('8', 1100)
    ],
    supply: [
        { definitionId: '2', count: 40 },
        { definitionId: '2+', count: 4 },
        { definitionId: '3', count: 12 },
        { definitionId: '4', count: 8 },
        { definitionId: '5', count: 5 },
        { definitionId: '6', count: 4 },
        { definitionId: '7', count: 3 },
        { definitionId: '8', count: 'unlimited' }
    ]
})

// The 2+ is made obsolete rather than rusted by the 4: it runs once more, then rusts.
export const ObsoleteTrainIds: readonly string[] = ['2+']

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']
export const EighteenSeventeenPhases = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 2, trainLimit: 4 },
        { id: '2+', startedBy: ['2+'], tileColors: yellow, operatingRounds: 2, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 2, trainLimit: 3 },
        { id: '6', startedBy: ['6'], tileColors: brown, operatingRounds: 2, trainLimit: 2 },
        { id: '7', startedBy: ['7'], tileColors: gray, operatingRounds: 2, trainLimit: 2 },
        { id: '8', startedBy: ['8'], tileColors: gray, operatingRounds: 2, trainLimit: 2 }
    ],
    EighteenSeventeenTrainDepot
)

/** The share counts a company may be formed with in each phase. */
export const EighteenSeventeenCompanySizes: Readonly<Record<string, readonly number[]>> = {
    '2': [2],
    '2+': [2],
    '3': [2, 5],
    '4': [5],
    '5': [5, 10],
    '6': [10],
    '7': [10],
    '8': [10]
}

export const EighteenSeventeenTrainRules: TrainRules = {
    depot: EighteenSeventeenTrainDepot,
    exchangePrice: () => undefined,
    requiresTrain: () => false,
    availableDefinitions(state) {
        const next = EighteenSeventeenTrainDepot.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        EighteenSeventeenPhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => EighteenSeventeenPhases.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited'
}
