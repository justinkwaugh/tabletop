import * as Type from 'typebox'
import { ActionSource, assert, assertExists, type HydratedGameState } from '@tabletop/common'
import {
    CashPayment,
    controllingOwner,
    finiteCashOwnedBy,
    recordStockAction,
    releaseTrains,
    settleCashPayments,
    titleAction,
    trainsCountingForLimit,
    trainsOwnedBy,
    type ActingCompanyAction,
    type ActionDefinition,
    type CorporateStockAction,
    type StockState,
    type FinancialState,
    type TrainPurchaseState
} from '@tabletop/18xx'
import type { EighteenUSAState, HydratedEighteenUSAState } from './state.js'
import { EighteenUSAStockRoundRules } from './roundRules.js'
import { ownsPullman, EighteenUSATrainRules } from './trainRules.js'
import {
    EighteenUSAPhases,
    EighteenUSATrainDepot,
    PullmanAvailablePhaseId,
    PullmanScrapValue,
    PullmanTrainId
} from './trains.js'

type State = TrainPurchaseState & StockState & EighteenUSAState

/** The steps of an operating turn before its run, in which a Pullman may be bought (§12.7). */
export const BeforeRunStates: readonly string[] = ['LayingTrack', 'PlacingStation', 'RunningTrains']

function presides(state: FinancialState, playerId: string, companyId: string): boolean {
    return controllingOwner(state, companyId)?.playerId === playerId
}

function ownedPullman(state: State, companyId: string) {
    return trainsOwnedBy(state, { kind: 'company', companyId }).find(
        (train) => train.definitionId === PullmanTrainId
    )
}

function pullmanPrice(state: State, companyId: string): number {
    const printed = EighteenUSATrainDepot.trainDefinition(PullmanTrainId).price
    return EighteenUSATrainRules.bankPrice?.(state, companyId, PullmanTrainId, printed) ?? printed
}

/** Why the company may not buy a Pullman from the bank before it runs now. */
export function pullmanPurchaseReason(state: State, companyId: string): string | undefined {
    if (!EighteenUSAPhases.isAtLeast(state.phaseId, PullmanAvailablePhaseId))
        return 'Pullmans are sold from phase 5.'
    if (ownsPullman(state, companyId)) return 'A company may own only one Pullman.'
    if (
        trainsCountingForLimit(state, EighteenUSATrainRules, companyId).length >=
        EighteenUSATrainRules.trainLimit(state, companyId)
    )
        return 'The company is at its train limit.'
    if (finiteCashOwnedBy(state, { kind: 'company', companyId }) < pullmanPrice(state, companyId))
        return 'The company cannot pay for a Pullman.'
    return undefined
}

const BuyPullmanAction = titleAction('BuyPullman', {
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { trainId: Type.String(), payment: CashPayment },
            { additionalProperties: false }
        )
    )
})
export const BuyPullman = BuyPullmanAction.schema
export type BuyPullman = Type.Static<typeof BuyPullman>
export const isBuyPullman = BuyPullmanAction.is

const ScrapPullmanAction = titleAction('ScrapPullman', {
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { trainId: Type.String(), payment: CashPayment },
            { additionalProperties: false }
        )
    )
})
export const ScrapPullman = ScrapPullmanAction.schema
export type ScrapPullman = Type.Static<typeof ScrapPullman>
export const isScrapPullman = ScrapPullmanAction.is

class HydratedBuyPullman extends BuyPullmanAction.Base implements BuyPullman {
    declare type: 'BuyPullman'
    declare playerId: string
    declare companyId: string
    declare metadata?: BuyPullman['metadata']
    apply(state: HydratedGameState & State): void {
        assert(
            this.source === ActionSource.User &&
                presides(state, this.playerId, this.companyId) &&
                BeforeRunStates.includes(state.machineState) &&
                !pullmanPurchaseReason(state, this.companyId),
            'The company cannot buy a Pullman now'
        )
        const company = { kind: 'company' as const, companyId: this.companyId }
        const train = EighteenUSATrainDepot.nextTrain(state.trainInventory, PullmanTrainId)
        assertExists(train, 'Pullmans are unlimited')
        EighteenUSATrainDepot.purchase(state.trainInventory, train.id, PullmanTrainId, company)
        const payment = {
            from: company,
            to: { kind: 'bank' as const },
            amount: pullmanPrice(state, this.companyId)
        }
        settleCashPayments(state, [payment])
        this.metadata = { trainId: train.id, payment }
    }
}

class HydratedScrapPullman extends ScrapPullmanAction.Base implements ScrapPullman {
    declare type: 'ScrapPullman'
    declare playerId: string
    declare companyId: string
    declare metadata?: ScrapPullman['metadata']
    apply(state: HydratedGameState & State): void {
        const train = ownedPullman(state, this.companyId)
        assert(
            this.source === ActionSource.User &&
                presides(state, this.playerId, this.companyId) &&
                !!train,
            'The company has no Pullman to scrap'
        )
        assertExists(train, 'A scrapped Pullman is the company’s')
        releaseTrains(state.trainInventory, [train.id], 'removed')
        // Scrapping in a stock round is the president's turn acting for the company (§11.7).
        if (state.machineState === 'StockRound') {
            state.stockRound.turn.corporateAction ??= { companyId: this.companyId }
            recordStockAction(state, this.playerId, EighteenUSAStockRoundRules)
        }
        const payment = {
            from: { kind: 'bank' as const },
            to: { kind: 'company' as const, companyId: this.companyId },
            amount: PullmanScrapValue
        }
        settleCashPayments(state, [payment])
        this.metadata = { trainId: train.id, payment }
    }
}

export const PullmanActions: readonly ActionDefinition[] = [
    BuyPullmanAction.define((action) => new HydratedBuyPullman(action)),
    ScrapPullmanAction.define((action) => new HydratedScrapPullman(action))
]

/** Scrapping a Pullman for $50, wherever the company may act (§12.7). */
export const ScrapPullmanCompanyAction: ActingCompanyAction<HydratedEighteenUSAState> = {
    type: 'ScrapPullman',
    available: (state, playerId, companyId) =>
        presides(state, playerId, companyId) && !!ownedPullman(state, companyId),
    isValid: (action, state, companyId) =>
        isScrapPullman(action) &&
        action.companyId === companyId &&
        presides(state, action.playerId, companyId) &&
        !!ownedPullman(state, companyId)
}

/** Buying a Pullman from the bank before the company's run (§12.7). */
export const BuyPullmanCompanyAction: ActingCompanyAction<HydratedEighteenUSAState> = {
    type: 'BuyPullman',
    available: (state, playerId, companyId) =>
        BeforeRunStates.includes(state.machineState) &&
        presides(state, playerId, companyId) &&
        !pullmanPurchaseReason(state, companyId),
    isValid: (action, state, companyId) =>
        isBuyPullman(action) &&
        action.companyId === companyId &&
        BeforeRunStates.includes(state.machineState) &&
        presides(state, action.playerId, companyId) &&
        !pullmanPurchaseReason(state, companyId)
}

/** Scrapping a Pullman as the president's stock turn for its company (§11.7, §12.7). */
export const ScrapPullmanStockAction: CorporateStockAction<HydratedEighteenUSAState> = {
    type: 'ScrapPullman',
    available: (state, playerId) =>
        !state.companyAuction &&
        state.companies.some(
            (company) =>
                company.kind === 'major' &&
                !company.closed &&
                presides(state, playerId, company.id) &&
                !!ownedPullman(state, company.id) &&
                (!state.stockRound.turn.corporateAction ||
                    state.stockRound.turn.corporateAction.companyId === company.id)
        ),
    isValid: (action, state) =>
        isScrapPullman(action) &&
        !state.companyAuction &&
        presides(state, action.playerId, action.companyId) &&
        !!ownedPullman(state, action.companyId) &&
        (!state.stockRound.turn.corporateAction ||
            state.stockRound.turn.corporateAction.companyId === action.companyId)
}
