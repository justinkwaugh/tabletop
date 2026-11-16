import { assertExists } from '@tabletop/common'
import {
    PhaseTable,
    TrainDepot,
    dieselTrains,
    revenueStagesByPhase,
    type TrainInventory,
    type TrainPurchaseState,
    type TrainRules
} from '@tabletop/18xx'

const distance = (maximum: number | 'unlimited') =>
    ({ measure: 'revenue-centers', maximum }) as const

export const DieselId = 'D'
/** The 8-train of the alternate trains variant, sold in place of the Diesel (Variants). */
export const EightTrainId = '8'

export const DieselSupply1856 = '1856:diesels'
export const EightTrainSupply1856 = '1856:8-trains'

/** The train roster with both final trains: each game's supply sells only its own (Set-Up). */
export const TrainDepot1856 = new TrainDepot({
    id: '1856',
    trains: [
        { id: '2', name: '2', price: 100, distance: distance(2), rustsOn: '4' },
        { id: '3', name: '3', price: 225, distance: distance(3), rustsOn: '6' },
        { id: '4', name: '4', price: 350, distance: distance(4), rustsOn: DieselId },
        { id: '5', name: '5', price: 550, distance: distance(5) },
        { id: '6', name: '6', price: 700, distance: distance(6) },
        { id: DieselId, name: 'D', price: 1100, distance: distance('unlimited') },
        { id: EightTrainId, name: '8', price: 1000, distance: distance(8) }
    ],
    supply: [
        { definitionId: '2', count: 6 },
        { definitionId: '3', count: 5 },
        { definitionId: '4', count: 4 },
        { definitionId: '5', count: 3 },
        { definitionId: '6', count: 2 },
        { definitionId: DieselId, count: 'unlimited' },
        { definitionId: EightTrainId, count: 'unlimited' }
    ],
    supplyVariants: {
        [DieselSupply1856]: { [EightTrainId]: 0 },
        [EightTrainSupply1856]: { [DieselId]: 0 }
    }
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']

/**
 * The six phases, named for the trains that start them. The 8-train variant's last phase follows
 * the 6s in place of the Diesels' (Game Phases, Variants).
 */
export const Phases1856 = new PhaseTable(
    [
        { id: '2', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: '3', startedBy: ['3'], tileColors: green, operatingRounds: 2, trainLimit: 4 },
        { id: '4', startedBy: ['4'], tileColors: green, operatingRounds: 2, trainLimit: 3 },
        { id: '5', startedBy: ['5'], tileColors: brown, operatingRounds: 3, trainLimit: 2 },
        { id: '6', startedBy: ['6'], tileColors: gray, operatingRounds: 3, trainLimit: 2 },
        {
            id: DieselId,
            startedBy: [DieselId],
            tileColors: gray,
            operatingRounds: 3,
            trainLimit: 2
        },
        {
            id: EightTrainId,
            startedBy: [EightTrainId],
            tileColors: gray,
            operatingRounds: 3,
            trainLimit: 2,
            variantEnd: true
        }
    ],
    TrainDepot1856
)

/** Phases from which companies may buy players' privates, and privates' powers are of use. */
export const PrivatePurchasePhaseIds: readonly string[] = ['3', '4']
/** The phase that closes the privates (Phase Four). */
export const PrivateClosurePhaseId = '5'
/** The phase whose first train forms the CGR and removes the port (Phase Five). */
export const NationalPhaseId = '6'
/** From the 6-trains, small cities may be upgraded or downgraded (Phase Five). */
export const TownUpgradePhaseId = '6'

/** The CGR may hold one train more than the other companies (Phase Five). */
export const NationalTrainLimit = 3

/** Red areas pay their first value until the 5s, their second until the last phase (Game Phases). */
export const revenueStages1856 = revenueStagesByPhase(Phases1856, 'yellow', [
    ['brown', '5'],
    ['black', DieselId]
])

/** The game's final train, the Diesel or the variant's 8-train. */
export function finalTrainId(inventory: TrainInventory): string {
    return inventory.depotId === EightTrainSupply1856 ? EightTrainId : DieselId
}

/** What a 4, 5 or 6 traded in takes off the final train's price. */
export const FinalTrainCredit = 350

/**
 * Diesels sell from the first 6-train for $1100, or $750 trading in a 4, 5 or 6; the variant's
 * 8-trains for $1000, or $650 with a train traded in (Trains, Variants).
 */
const FinalTrainSales: Readonly<
    Record<string, Pick<TrainRules, 'availableDefinitions' | 'exchangePrice'>>
> = {
    [DieselId]: dieselTrains({
        depot: TrainDepot1856,
        phases: Phases1856,
        dieselId: DieselId,
        fromPhaseId: '6',
        tradeInIds: ['4', '5', '6'],
        credit: FinalTrainCredit
    }),
    [EightTrainId]: dieselTrains({
        depot: TrainDepot1856,
        phases: Phases1856,
        dieselId: EightTrainId,
        fromPhaseId: '6',
        tradeInIds: ['4', '5', '6'],
        credit: FinalTrainCredit
    })
}

export function finalTrainSales(state: Pick<TrainPurchaseState, 'trainInventory'>) {
    const sales = FinalTrainSales[finalTrainId(state.trainInventory)]
    assertExists(sales, 'Every game sells a final train')
    return sales
}

/** The game's train supply. */
export function createTrainInventory1856(eightTrains: boolean): TrainInventory {
    return TrainDepot1856.createInventory(eightTrains ? EightTrainSupply1856 : DieselSupply1856)
}

/**
 * The train type on sale that sets how many shares a company must have sold to operate for the
 * first time: the next train in the bank, the final train counting as a 6 (Initial Shares
 * Needed to Operate).
 */
export function trainTypeOnSale(inventory: TrainInventory): number {
    const next = TrainDepot1856.nextDefinitionId(inventory)
    const type = next ? Number.parseInt(next) : 6
    return Number.isNaN(type) || type > 6 ? 6 : type
}

/** Permanent trains, which never rust: the 5s and above (Trains). */
export function isPermanentTrain(definitionId: string): boolean {
    return !TrainDepot1856.trainDefinition(definitionId).rustsOn
}
