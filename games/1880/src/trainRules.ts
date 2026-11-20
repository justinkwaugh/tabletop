import { assert, assertExists } from '@tabletop/common'
import {
    closePrivate,
    exportDepotTrains,
    settleCashPayments,
    getCompany,
    hasTurnMark,
    interruptForStockRound,
    markTurn,
    nextOperatingCompany,
    privateOwner,
    trainsOwnedBy,
    type TrainExport,
    type TrainPurchaseState,
    type TrainRules
} from '@tabletop/18xx'
import { P0Id, P0Payments, P7Id } from './companies.js'
import { requireState1880, type HydratedState1880 } from './state.js'
import { MajorIds1880 } from './stock.js'
import { Phases1880, RestoredTwoId, TrainDepot1880 } from './trains.js'

/** Marks the train-marker company's turn once it has bought from the bank. */
export const BoughtTrainMark = 'bought-new-train'
/** Marks the turn in which the trains on sale were removed, so its company may then finish. */
export const RemovedTrainsMark = 'removed-unbought-trains'

/** Trains whose running out brings no share round: the last of them is the last 8 (§XI, §XII). */
const NoShareRoundIds: readonly string[] = [RestoredTwoId, '8E', '10']
/** Trains never removed for going unbought (§X Purchase of Trains). */
const NeverRemovedIds: readonly string[] = [RestoredTwoId, '10']

function remaining(state: TrainPurchaseState, definitionId: string): number | 'unlimited' {
    return TrainDepot1880.remaining(state.trainInventory, definitionId)
}

/** The kind of new train the bank sells now; restored 2-trains aside (§X). */
export function trainOnSale(state: TrainPurchaseState): string {
    const definitionId = TrainDepot1880.nextDefinitionId(state.trainInventory)
    assertExists(definitionId, 'The bank always sells a train')
    return definitionId
}

/** Whether the restored 2-trains are on sale: from the first 6-train (§XI). */
function restoredTwosOnSale(state: TrainPurchaseState): boolean {
    return Phases1880.isAtLeast(state.phaseId, 'C2') && remaining(state, RestoredTwoId) !== 0
}

/** After the first 8E-train, or both removed, no train leaves for going unbought (§X). */
function removalsEnded(state: TrainPurchaseState): boolean {
    return remaining(state, '8E') !== 2
}

/**
 * Whether the train-marker company, finishing without buying, ends a whole round without a new
 * train: the trains on sale then leave the game (§X). Not again in the turn they first left.
 */
function removalDue(state: HydratedState1880, companyId: string): boolean {
    return (
        state.trainMarker === companyId &&
        !hasTurnMark(state, BoughtTrainMark) &&
        !hasTurnMark(state, RemovedTrainsMark) &&
        !removalsEnded(state) &&
        !NeverRemovedIds.includes(trainOnSale(state))
    )
}

/** The train the Rocket of China is exchanged for as the phase B3 begins (§VI). */
const RocketTrainId = '4'

/**
 * The trains on sale leave the game, each as though bought, so that the first of a kind starts
 * its phase (FAQ); a share round follows unless they were the 8E-trains (§X, §XII). When the
 * 4-trains leave with the Rocket of China still open, one stays in the bank for its forced
 * exchange, which the first to leave brings (R53).
 */
function removeUnboughtTrains(state: HydratedState1880, companyId: string): TrainExport {
    const definitionId = trainOnSale(state)
    const count = remaining(state, definitionId)
    assert(count !== 'unlimited', 'Only a finite supply is removed')
    const keptForRocket = definitionId === RocketTrainId && !getCompany(state, P7Id).closed ? 1 : 0
    assert(count > keptForRocket, 'The first of the removed trains starts its phase')
    markTurn(state, RemovedTrainsMark)
    const removed = exportDepotTrains(
        state,
        TrainRules1880,
        Array.from({ length: count - keptForRocket }, () => definitionId),
        { machineState: 'BuyingTrains', companyId }
    )
    afterLastOfKind(state, definitionId, companyId)
    return removed
}

/**
 * What the last train of a kind leaving the bank brings, bought, removed or taken by the Rocket
 * of China: a share round, the company resuming its turn after it where it was, and from the
 * last 8-train the game's final rounds (§XII, §XV). The last 3+3-train pays P0 its ¥100 if no
 * earlier payment was taken (§VI). A share round already due is not brought twice (R53).
 */
export function afterLastOfKind(
    state: HydratedState1880,
    definitionId: string,
    companyId: string,
    resumeState = 'BuyingTrains'
): void {
    if (definitionId === '8') {
        const set = state.operatingSet
        assertExists(set, 'The last 8-train leaves in an operating round')
        state.lastEightRound = set.roundNumber
    }
    if (p0Payment(state, definitionId) === LastP0Payment) payP0(state, LastP0Payment)
    if (!NoShareRoundIds.includes(definitionId) && !state.stockRoundInterruption)
        interruptForStockRound(state, companyId, resumeState)
}

/** P0's last payment, which comes unclaimed with the last 3+3-train (§VI). */
const LastP0Payment = 100

/** Pays P0's owner its one-off payment; P0 then closes (§VI). */
export function payP0(state: HydratedState1880, amount: number): void {
    const owner = privateOwner(state, P0Id)
    if (owner?.kind === 'player')
        settleCashPayments(state, [{ from: { kind: 'bank' }, to: owner, amount }])
    closePrivate(state, P0Id)
}

/** The P0 payment the last train of this kind earns, if P0 is still open (§VI). */
export function p0Payment(state: TrainPurchaseState, definitionId: string): number | undefined {
    const payment = P0Payments.find((entry) => entry.definitionId === definitionId)
    return payment && !getCompany(state, P0Id).closed ? payment.amount : undefined
}

export const TrainRules1880: TrainRules = {
    depot: TrainDepot1880,
    exchangePrice: () => undefined,
    // Each major must own a train at the end of its turn; a restored 2-train does not count.
    // Foreign investors lease theirs (§VII, §X).
    requiresTrain: (_state, companyId) => MajorIds1880.includes(companyId),
    satisfiesRequirement: (_state, train) => train.definitionId !== RestoredTwoId,
    availableDefinitions: (state) => [
        trainOnSale(state),
        ...(restoredTwosOnSale(state) ? [RestoredTwoId] : [])
    ],
    limitReason(state, companyId, definitionId) {
        if (!MajorIds1880.includes(companyId)) return 'Foreign investors lease their trains.'
        if (
            definitionId === RestoredTwoId &&
            trainsOwnedBy(state, { kind: 'company', companyId }).some(
                (train) => train.definitionId === RestoredTwoId
            )
        )
            return 'A company owns at most one restored 2-train.'
        return undefined
    },
    phaseAfterPurchase: (state, definitionId) =>
        Phases1880.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Phases1880.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    // Finishing when the trains on sale are due to leave removes them, and the company buys on
    // after them: after the share round they bring, or at once after the 8E-trains, as 18xx.games
    // has it (the designers have not ruled; owner's choice).
    declineResumes: (state, companyId) => removalDue(requireState1880(state), companyId),
    declineTrains(stateObject, companyId) {
        const state = requireState1880(stateObject)
        return removalDue(state, companyId) ? removeUnboughtTrains(state, companyId) : undefined
    },
    // A new train from the bank moves the train marker, until the last 8-train; the last of a
    // kind brings a share round (§X, §XII).
    afterTrainsDepart(stateObject, departures) {
        const state = requireState1880(stateObject)
        for (const departure of departures) {
            if (departure.cause !== 'purchase' || departure.owner) continue
            if (departure.definitionId === RestoredTwoId) continue
            const companyId = nextOperatingCompany(state)
            assertExists(companyId, 'A train is bought in an operating turn')
            if (state.lastEightRound === undefined) state.trainMarker = companyId
            markTurn(state, BoughtTrainMark)
            // The bought train is still counted in the bank as its departure settles.
            if (remaining(state, departure.definitionId) === 1)
                afterLastOfKind(state, departure.definitionId, companyId)
        }
        return []
    }
}
