import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction
} from '@tabletop/common'
import {
    CashPayment,
    StockMarketMove,
    TrainPurchaseDetails,
    TrainPurchase,
    applyTrainPurchase,
    companyMarketSpace,
    moveMarketSpace,
    moveCompanyMarker,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    settleCashPayments,
    trainsOwnedBy,
    reorderPendingOperatingCompanies
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'
import { corporateFinanceCertificates, corporateIssueLimit } from './corporateFinance.js'
import { TrainRules1846 } from './trains.js'
import { OperatingRules1846 } from './operating.js'

const EmergencyPurchase = Type.Object(
    {
        ...Type.Omit(TrainPurchaseDetails, ['exchangeTrainId']).properties,
        issuedShares: Type.Integer({ minimum: 0 }),
        proceeds: Type.Integer({ minimum: 0 }),
        contribution: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type EmergencyPurchase = Type.Static<typeof EmergencyPurchase>

export function emergencyBankOffers(state: HydratedEighteenFortySixState): TrainPurchaseDetails[] {
    const companyId = state.trainPurchaseStep?.companyId
    assertExists(companyId, 'Depot offers require a buying corporation')
    const purchase = new TrainPurchase(
        {
            ...state,
            cash: state.cash.map((balance) =>
                balance.owner.kind === 'company' && balance.owner.companyId === companyId
                    ? { ...balance, amount: 'unlimited' as const }
                    : balance
            )
        },
        TrainRules1846
    )
    return [
        ...purchase.offers().map((offer) => offer.evaluation),
        ...purchase.marketOffers()
    ].flatMap((evaluation) => (evaluation.details ? [evaluation.details] : []))
}

export function emergencyFundingChoices(state: HydratedEighteenFortySixState): EmergencyPurchase[] {
    const companyId = state.trainPurchaseStep?.companyId
    if (
        !['BuyingTrains', 'FundingTrain'].includes(state.machineState) ||
        !companyId ||
        state.purchaseOffer ||
        state.pendingRevenueMarker
    )
        return []
    const owner = { kind: 'company' as const, companyId }
    const president = controllingOwner(state, companyId)
    if (
        !president ||
        getCompany(state, companyId).closed ||
        getCompany(state, companyId).kind !== 'major' ||
        trainsOwnedBy(state, owner).length
    )
        return []
    const treasury = finiteCashOwnedBy(state, owner)
    const offers = emergencyBankOffers(state)
    const cheapest = Math.min(...offers.map((offer) => offer.price))
    const space = companyMarketSpace(state.stockMarket, companyId)
    const issuances = Array.from(
        { length: state.emergencyFunding ? 0 : corporateIssueLimit(state, companyId) },
        (_, i) => {
            const issuedShares = i + 1
            const after = moveMarketSpace(state.stockMarket, space.id, 'left', issuedShares)
            const price = moveMarketSpace(state.stockMarket, after.id, 'left', 1).price
            return { issuedShares, proceeds: issuedShares * price, stockPrice: after.price }
        }
    ).filter((issue) => issue.stockPrice >= 20 && issue.proceeds > 0)
    const canAffordCheapest =
        treasury >= cheapest || issuances.some((issue) => treasury + issue.proceeds >= cheapest)
    return offers.flatMap((offer) => {
        if (treasury >= offer.price || offer.price < (state.emergencyFunding?.minimumPrice ?? 0))
            return []
        const issuance =
            issuances.find((issue) => treasury + issue.proceeds >= offer.price) ?? issuances.at(-1)
        const issuedShares = issuance?.issuedShares ?? 0
        const proceeds = issuance?.proceeds ?? 0
        const contribution = Math.max(0, offer.price - treasury - proceeds)
        if (contribution && canAffordCheapest) return []
        return [{ ...offer, issuedShares, proceeds, contribution }]
    })
}

export function emergencyTrainChoices(state: HydratedEighteenFortySixState): EmergencyPurchase[] {
    return emergencyFundingChoices(state).filter((choice) => {
        const president = controllingOwner(state, choice.companyId)
        assertExists(president, 'Emergency buying requires a president')
        return finiteCashOwnedBy(state, president) >= choice.contribution
    })
}

export function emergencyFundingStart(
    state: HydratedEighteenFortySixState
): EmergencyPurchase | undefined {
    if (state.machineState !== 'BuyingTrains' || state.emergencyFunding) return undefined
    return emergencyFundingChoices(state).find((choice) => {
        const president = controllingOwner(state, choice.companyId)
        assertExists(president, 'Emergency funding requires a president')
        return choice.contribution > finiteCashOwnedBy(state, president)
    })
}

const EmergencyIssuance = Type.Object(
    {
        certificateIds: Type.Array(Type.String()),
        payments: Type.Array(CashPayment),
        stockMove: Type.Optional(StockMarketMove)
    },
    { additionalProperties: false }
)

function issueEmergencyShares(
    state: HydratedEighteenFortySixState,
    choice: EmergencyPurchase
): Type.Static<typeof EmergencyIssuance> {
    const owner = { kind: 'company' as const, companyId: choice.companyId }
    const certificates = corporateFinanceCertificates(state, choice.companyId, 'issue').slice(
        0,
        choice.issuedShares
    )
    const stockMove = moveCompanyMarker(
        state.stockMarket,
        choice.companyId,
        'left',
        choice.issuedShares
    )
    const payments: CashPayment[] = choice.proceeds
        ? [{ from: { kind: 'bank' }, to: owner, amount: choice.proceeds }]
        : []
    settleCashPayments(state, payments)
    for (const certificate of certificates) {
        certificate.owner = { kind: 'bank' }
        certificate.poolId = 'open-market'
    }
    reorderPendingOperatingCompanies(state, OperatingRules1846.companyOrder(state))
    return {
        certificateIds: certificates.map((certificate) => certificate.id),
        payments,
        ...(stockMove ? { stockMove } : {})
    }
}

export const StartEmergencyFunding = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('StartEmergencyFunding'),
        source: Type.Literal(ActionSource.User),
        companyId: Type.String(),
        metadata: Type.Optional(EmergencyIssuance)
    },
    { additionalProperties: false }
)
const StartValidator = Compile(StartEmergencyFunding)
export function isStartEmergencyFunding(
    action: GameAction
): action is Type.Static<typeof StartEmergencyFunding> {
    return action.type === 'StartEmergencyFunding' && StartValidator.Check(action)
}
export class StartEmergencyFundingAction extends HydratableAction<typeof StartEmergencyFunding> {
    declare playerId: string
    declare companyId: string
    declare metadata?: Type.Static<typeof StartEmergencyFunding>['metadata']
    constructor(data: Type.Static<typeof StartEmergencyFunding>) {
        super(data, StartValidator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            emergencyFundingStart(state)?.companyId === this.companyId
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Invalid emergency funding start')
        const choice = emergencyFundingStart(state)
        assertExists(choice, 'Emergency funding requires a purchase shortfall')
        this.metadata = issueEmergencyShares(state, choice)
        state.emergencyFunding = { companyId: this.companyId, minimumPrice: 0, soldCompanyIds: [] }
    }
}

export const EmergencyBuyTrain = Type.Object(
    {
        ...PlayerAction.properties,
        ...EmergencyPurchase.properties,
        type: Type.Literal('EmergencyBuyTrain'),
        source: Type.Literal(ActionSource.User),
        metadata: Type.Optional(EmergencyIssuance)
    },
    { additionalProperties: false }
)
const Validator = Compile(EmergencyBuyTrain)
export function isEmergencyBuyTrain(
    action: GameAction
): action is Type.Static<typeof EmergencyBuyTrain> {
    return action.type === 'EmergencyBuyTrain' && Validator.Check(action)
}
export class EmergencyBuyTrainAction extends HydratableAction<typeof EmergencyBuyTrain> {
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare definitionId: string
    declare price: number
    declare issuedShares: number
    declare proceeds: number
    declare contribution: number
    declare metadata?: Type.Static<typeof EmergencyBuyTrain>['metadata']
    constructor(data: Type.Static<typeof EmergencyBuyTrain>) {
        super(data, Validator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            emergencyTrainChoices(state).some(
                (choice) =>
                    choice.companyId === this.companyId &&
                    choice.trainId === this.trainId &&
                    choice.definitionId === this.definitionId &&
                    choice.price === this.price &&
                    choice.issuedShares === this.issuedShares &&
                    choice.proceeds === this.proceeds &&
                    choice.contribution === this.contribution
            )
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Invalid emergency train purchase')
        const company = { kind: 'company' as const, companyId: this.companyId }
        const issuance = issueEmergencyShares(state, this)
        const payments: CashPayment[] = []
        if (this.contribution)
            payments.push({
                from: { kind: 'player', playerId: this.playerId },
                to: company,
                amount: this.contribution
            })
        settleCashPayments(state, payments)
        const purchase = {
            companyId: this.companyId,
            trainId: this.trainId,
            definitionId: this.definitionId,
            price: this.price
        }
        applyTrainPurchase(state, purchase, TrainRules1846)
        if (state.phaseChange) state.phaseChange.continuation.machineState = 'BuyingTrains'
        payments.push({ from: company, to: { kind: 'bank' }, amount: this.price })
        delete state.emergencyFunding
        this.metadata = { ...issuance, payments: [...issuance.payments, ...payments] }
    }
}
