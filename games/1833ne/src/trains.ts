import {
    PhaseTable,
    TrainDepot,
    trainCanBeTraded,
    type PhaseRules,
    type TrainRules
} from '@tabletop/18xx'

const revenueCenters = (maximum: number, extraTowns?: number) => ({
    measure: 'revenue-centers' as const,
    maximum,
    ...(extraTowns ? { extraTowns } : {})
})

/** Each certificate before phase V has two sides at different prices (§6.85). */
export const TrainDepot1833NE = new TrainDepot({
    id: '1833ne',
    trains: [
        { id: '2', name: '2', price: 75, distance: revenueCenters(2) },
        { id: '2+1', name: '2+1', price: 100, distance: revenueCenters(2, 1) },
        { id: '3/5', name: '3/5', price: 180, distance: revenueCenters(5) },
        { id: '2+2', name: '2+2', price: 140, distance: revenueCenters(2, 2) },
        { id: '4/7', name: '4/7', price: 320, distance: revenueCenters(7) },
        { id: '3+3', name: '3+3', price: 230, distance: revenueCenters(3, 3) },
        { id: '6/9', name: '6/9', price: 750, distance: revenueCenters(9) },
        { id: '5+3', name: '5+3', price: 640, distance: revenueCenters(5, 3) },
        { id: '7+3', name: '7+3', price: 1000, distance: revenueCenters(7, 3) }
    ],
    supply: [
        { definitionId: '2', variantDefinitionIds: ['2+1'], count: 8 },
        { definitionId: '3/5', variantDefinitionIds: ['2+2'], count: 5 },
        { definitionId: '4/7', variantDefinitionIds: ['3+3'], count: 6 },
        { definitionId: '6/9', variantDefinitionIds: ['5+3'], count: 3 },
        { definitionId: '7+3', count: 'unlimited' }
    ]
})

/** The paying stops of N/M trains: up to N of the M visited. */
export const PayingStopLimits: Readonly<Record<string, number>> = { '3/5': 3, '4/7': 4, '6/9': 6 }

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
export const Phases1833NE = new PhaseTable(
    [
        { id: 'I', startedBy: [], tileColors: yellow, operatingRounds: 2, trainLimit: 3 },
        {
            id: 'II',
            startedBy: ['3/5', '2+2'],
            tileColors: green,
            operatingRounds: 2,
            trainLimit: 3
        },
        {
            id: 'III',
            startedBy: ['4/7', '3+3'],
            tileColors: green,
            operatingRounds: 2,
            trainLimit: 3
        },
        {
            id: 'IV',
            startedBy: ['6/9', '5+3'],
            tileColors: brown,
            operatingRounds: 2,
            trainLimit: 2
        },
        { id: 'V', startedBy: ['7+3'], tileColors: brown, operatingRounds: 2, trainLimit: 2 }
    ],
    TrainDepot1833NE
)

const PhaseTrains: Readonly<Record<string, readonly string[]>> = {
    I: ['2', '2+1'],
    II: ['3/5', '2+2'],
    III: ['4/7', '3+3']
}

/**
 * Entering a phase phases out the trains of two phases before, removed after their owner next
 * runs, and removes those of three phases before (§6.82).
 */
export function trainRetirement(
    phaseId: string,
    definitionId: string
): 'immediate' | 'after-operation' | undefined {
    const phases = Phases1833NE.phases.map((phase) => phase.id)
    const current = phases.indexOf(phaseId)
    const owning = Object.entries(PhaseTrains).find(([, ids]) => ids.includes(definitionId))?.[0]
    if (!owning) return undefined
    const age = current - phases.indexOf(owning)
    if (age >= 3) return 'immediate'
    if (age === 2) return 'after-operation'
    return undefined
}

/**
 * The periods the board prints values for, changing at phases III and V: off-board values and
 * route bonuses, each drawn as a revenue stage.
 */
export const ValuePeriods = [
    { id: 'I-II', from: 'I', stage: 'yellow' },
    { id: 'III-IV', from: 'III', stage: 'brown' },
    { id: 'V', from: 'V', stage: 'gray' }
] as const
export type ValuePeriod = (typeof ValuePeriods)[number]['id']
export type PeriodValues = Partial<Record<ValuePeriod, number>>

function periodsReached(phaseId: string) {
    return ValuePeriods.filter((period) => Phases1833NE.isAtLeast(phaseId, period.from))
}

export function valuePeriod(phaseId: string): ValuePeriod {
    return periodsReached(phaseId).at(-1)?.id ?? 'I-II'
}

export function revenueStage(phaseId: string): readonly string[] {
    return periodsReached(phaseId).map((period) => period.stage)
}

export const TrainRules1833NE: TrainRules = {
    depot: TrainDepot1833NE,
    exchangePrice: () => undefined,
    // A corporation must own a train after its run, with or without a route (§6.86).
    requiresTrain: () => true,
    availableDefinitions: (state) => {
        const next = TrainDepot1833NE.nextDefinitionId(state.trainInventory)
        return next ? TrainDepot1833NE.certificateDefinitions(next) : []
    },
    marketDefinitions: (_state, train) =>
        TrainDepot1833NE.certificateDefinitions(train.definitionId),
    phaseAfterPurchase: (state, definitionId) =>
        Phases1833NE.phaseAfterPurchase(state.phaseId, definitionId),
    countsForLimit: (_state, train) => trainCanBeTraded(train),
    trainLimit: (state) => Phases1833NE.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited'
}

export const TrainRetirementRules: Pick<PhaseRules, 'rustTiming'> = {
    rustTiming: (state, train) => trainRetirement(state.phaseId, train.definitionId)
}
