import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type MachineStateHandler
} from '@tabletop/common'
import {
    EarningsDetails,
    EarningsDistribution,
    TrainPurchaseDetails,
    OperatingRoundSnapshot,
    applyEarningsDistribution,
    applyTrainPurchase,
    endOperatingTurn,
    finiteCashOwnedBy,
    nextOperatingCompany,
    operatingRoundSnapshot,
    trainsOwnedBy
} from '@tabletop/18xx'
import { inReceivership, operatingPlayers1846 } from './receivership.js'
import { emergencyBankOffers } from './emergencyTrain.js'
import { EarningsRules1846 } from './earnings.js'
import { TrainRules1846 } from './trains.js'
import { ValuationRules1846, nextOperatingState1846 } from './operating.js'
import { corporationAwaitingClosure } from './closeCorporation.js'
import type { HydratedEighteenFortySixState } from './state.js'

const StartReceiverTurnFields = Type.Object({
    type: Type.Literal('StartReceiverTurn'),
    source: Type.Literal(ActionSource.System),
    companyId: Type.String()
})
export const StartReceiverTurn: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> &
        typeof StartReceiverTurnFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartReceiverTurnFields.properties },
    { additionalProperties: false }
)
export const StartReceiverValidator: ReturnType<typeof Compile<typeof StartReceiverTurn>> =
    Compile(StartReceiverTurn)
export class StartReceiverTurnAction extends HydratableAction<typeof StartReceiverTurn> {
    declare companyId: string
    constructor(data: Type.Static<typeof StartReceiverTurn>) {
        super(data, StartReceiverValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                state.machineState === 'StartingOperatingTurn' &&
                state.operatingSet?.privateIncomePaid &&
                !state.operatingSet.completed &&
                nextOperatingCompany(state) === this.companyId &&
                inReceivership(state, this.companyId),
            'Invalid receiver turn'
        )
        state.activePlayerIds = operatingPlayers1846(state, this.companyId)
        state.turnManager.startTurn(state.activePlayerIds[0], state.actionCount + 1)
    }
}
const SettleReceiverFields = Type.Object({
    type: Type.Literal('SettleReceiver'),
    source: Type.Literal(ActionSource.System),
    companyId: Type.String(),
    metadata: Type.Optional(EarningsDetails)
})
export const SettleReceiver: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof SettleReceiverFields.properties
> = Type.Object(
    { ...GameAction.properties, ...SettleReceiverFields.properties },
    { additionalProperties: false }
)
export const SettleReceiverValidator: ReturnType<typeof Compile<typeof SettleReceiver>> =
    Compile(SettleReceiver)
export class SettleReceiverAction extends HydratableAction<typeof SettleReceiver> {
    declare companyId: string
    declare metadata?: EarningsDetails
    constructor(data: Type.Static<typeof SettleReceiver>) {
        super(data, SettleReceiverValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                state.machineState === 'SettlingReceiver' &&
                nextOperatingCompany(state) === this.companyId &&
                inReceivership(state, this.companyId),
            'Invalid receiver settlement'
        )
        const evaluation = new EarningsDistribution(state, EarningsRules1846).evaluate(
            this.companyId,
            'withhold'
        )
        assert(evaluation.details, evaluation.reason ?? 'Invalid receiver earnings')
        applyEarningsDistribution(state, evaluation.details)
        this.metadata = evaluation.details
    }
}
export function receiverTrainPurchase(
    state: HydratedEighteenFortySixState
): TrainPurchaseDetails | undefined {
    const companyId = state.trainPurchaseStep?.companyId
    if (
        !companyId ||
        !inReceivership(state, companyId) ||
        trainsOwnedBy(state, { kind: 'company', companyId }).length
    )
        return undefined
    const offer = emergencyBankOffers(state).toSorted((a, b) => a.price - b.price)[0]
    return offer && offer.price <= finiteCashOwnedBy(state, { kind: 'company', companyId })
        ? offer
        : undefined
}
const BuyReceiverTrainFields = Type.Object({
    type: Type.Literal('BuyReceiverTrain'),
    source: Type.Literal(ActionSource.System),
    companyId: Type.String(),
    metadata: Type.Optional(TrainPurchaseDetails)
})
export const BuyReceiverTrain: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof BuyReceiverTrainFields.properties
> = Type.Object(
    { ...GameAction.properties, ...BuyReceiverTrainFields.properties },
    { additionalProperties: false }
)
export const BuyReceiverValidator: ReturnType<typeof Compile<typeof BuyReceiverTrain>> =
    Compile(BuyReceiverTrain)
export class BuyReceiverTrainAction extends HydratableAction<typeof BuyReceiverTrain> {
    declare companyId: string
    declare metadata?: TrainPurchaseDetails
    constructor(data: Type.Static<typeof BuyReceiverTrain>) {
        super(data, BuyReceiverValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        const offer = receiverTrainPurchase(state)
        assert(
            this.source === ActionSource.System &&
                state.machineState === 'BuyingReceiverTrain' &&
                nextOperatingCompany(state) === this.companyId &&
                offer?.companyId === this.companyId,
            'Invalid receiver train purchase'
        )
        applyTrainPurchase(state, offer, TrainRules1846)
        if (state.phaseChange) state.phaseChange.continuation.machineState = 'FinishingReceiverTurn'
        this.metadata = offer
    }
}
const FinishReceiverTurnFields = Type.Object({
    type: Type.Literal('FinishReceiverTurn'),
    source: Type.Literal(ActionSource.System),
    companyId: Type.String(),
    metadata: Type.Optional(OperatingRoundSnapshot)
})
export const FinishReceiverTurn: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> &
        typeof FinishReceiverTurnFields.properties
> = Type.Object(
    { ...GameAction.properties, ...FinishReceiverTurnFields.properties },
    { additionalProperties: false }
)
export const FinishReceiverValidator: ReturnType<typeof Compile<typeof FinishReceiverTurn>> =
    Compile(FinishReceiverTurn)
export class FinishReceiverTurnAction extends HydratableAction<typeof FinishReceiverTurn> {
    declare companyId: string
    declare metadata?: OperatingRoundSnapshot
    constructor(data: Type.Static<typeof FinishReceiverTurn>) {
        super(data, FinishReceiverValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                ['BuyingReceiverTrain', 'FinishingReceiverTurn'].includes(state.machineState) &&
                nextOperatingCompany(state) === this.companyId &&
                inReceivership(state, this.companyId) &&
                !receiverTrainPurchase(state),
            'Invalid receiver turn completion'
        )
        endOperatingTurn(state, this.companyId)
        this.metadata = operatingRoundSnapshot(state, ValuationRules1846)
        delete state.trainPurchaseStep
        state.activePlayerIds = []
    }
}
export const settlingReceiverHandler: MachineStateHandler<
    SettleReceiverAction,
    HydratedEighteenFortySixState
> = {
    enter(context) {
        const companyId = nextOperatingCompany(context.gameState)
        assertExists(companyId, 'Receiver settlement requires a company')
        context.addSystemAction(SettleReceiver, { companyId })
    },
    validActionsForPlayer: () => [],
    isValidAction: (action, { gameState }) =>
        action instanceof SettleReceiverAction &&
        action.source === ActionSource.System &&
        action.companyId === nextOperatingCompany(gameState),
    onAction: (_action, { gameState }) =>
        corporationAwaitingClosure(gameState)
            ? 'ClosingOperatingCorporation'
            : 'BuyingReceiverTrain'
}
export const buyingReceiverHandler: MachineStateHandler<
    BuyReceiverTrainAction | FinishReceiverTurnAction,
    HydratedEighteenFortySixState
> = {
    enter(context) {
        const state = context.gameState
        const companyId = nextOperatingCompany(state)
        assertExists(companyId, 'Receiver buying requires a company')
        state.trainPurchaseStep ??= { companyId, purchasedTrainIds: [] }
        if (receiverTrainPurchase(state)) context.addSystemAction(BuyReceiverTrain, { companyId })
        else context.addSystemAction(FinishReceiverTurn, { companyId })
    },
    validActionsForPlayer: () => [],
    isValidAction(action, { gameState }) {
        return (
            (action instanceof BuyReceiverTrainAction ||
                action instanceof FinishReceiverTurnAction) &&
            action.source === ActionSource.System &&
            action.companyId === nextOperatingCompany(gameState) &&
            (receiverTrainPurchase(gameState)
                ? action instanceof BuyReceiverTrainAction
                : action instanceof FinishReceiverTurnAction)
        )
    },
    onAction(action, { gameState }) {
        return action instanceof FinishReceiverTurnAction
            ? nextOperatingState1846(gameState)
            : gameState.phaseChange
              ? 'AdvancingPhase'
              : 'FinishingReceiverTurn'
    }
}

export function isSettleReceiver(action: GameAction): action is Type.Static<typeof SettleReceiver> {
    return action.type === 'SettleReceiver' && SettleReceiverValidator.Check(action)
}
export function isBuyReceiverTrain(
    action: GameAction
): action is Type.Static<typeof BuyReceiverTrain> {
    return action.type === 'BuyReceiverTrain' && BuyReceiverValidator.Check(action)
}
