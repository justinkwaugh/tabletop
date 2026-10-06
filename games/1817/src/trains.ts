import type { EighteenSeventeenState } from './state.js'
import type { TrainPurchaseState } from '@tabletop/18xx'
import { PhaseTable, TrainDepot, type DeparturePayment, type TrainRules } from '@tabletop/18xx'
import { inventorPaid } from './state.js'
import { InventorId, ScrapperId, companyHolding } from './privateHolders.js'

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

const InventorPayouts: Readonly<Record<string, number>> = {
    '2': 20,
    '3': 30,
    '4': 40,
    '5': 50,
    '6': 60,
    '7': 70,
    '8': 80
}
const ScrapValues: Readonly<Record<string, number>> = { '2': 30, '2+': 30, '3': 75, '4': 150 }
const bankPays = (companyId: string, amount: number, privateId: string): DeparturePayment => ({
    from: { kind: 'bank' },
    to: { kind: 'company', companyId },
    amount,
    privateId
})

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
    purchaseLimit: () => 'unlimited',
    // The Inventor's company is paid the first time each type departs while it holds the
    // Inventor; the Scrapper's company is paid for each of its trains that rusts.
    afterTrainsDepart(
        state: TrainPurchaseState & Pick<EighteenSeventeenState, 'inventorPaid'>,
        departures
    ) {
        const payments: DeparturePayment[] = []
        const paid = [...inventorPaid(state)]
        const inventorCompanyId = companyHolding(state, InventorId)
        const scrapperCompanyId = companyHolding(state, ScrapperId)
        for (const departure of departures) {
            const payout = InventorPayouts[departure.definitionId]
            if (inventorCompanyId && payout && !paid.includes(departure.definitionId)) {
                paid.push(departure.definitionId)
                payments.push(bankPays(inventorCompanyId, payout, InventorId))
            }
            const scrap = ScrapValues[departure.definitionId]
            if (
                departure.cause === 'rust' &&
                scrap &&
                departure.owner?.kind === 'company' &&
                departure.owner.companyId === scrapperCompanyId
            )
                payments.push(bankPays(scrapperCompanyId, scrap, ScrapperId))
        }
        if (paid.length > inventorPaid(state).length) state.inventorPaid = paid
        return payments
    }
}
