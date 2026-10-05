import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type MachineStateHandler
} from '@tabletop/common'
import { canStartStockRound, defineAction, finiteCashOwnedBy } from '@tabletop/18xx'
import { Purchase, Selection, type HydratedEighteenFortySixState } from './state.js'
import { draftCompany } from './catalog.js'
import { nextDistributionPlayer, priceFor, purchaseOpeningCompany } from './distribution.js'

type State = HydratedEighteenFortySixState

export function unboughtOpeningCompanies(state: State): string[] {
    return state.certificates
        .filter(
            (certificate) =>
                !certificate.retired &&
                certificate.owner.kind === 'bank' &&
                certificate.id === `${certificate.companyId}:charter`
        )
        .map((certificate) => certificate.companyId)
}

export function openingPurchaseChoices(state: State, playerId: string) {
    if (state.machineState !== 'BuyingOpeningCompanies' || !state.isActivePlayer(playerId))
        return []
    const cash = finiteCashOwnedBy(state, { kind: 'player', playerId })
    return unboughtOpeningCompanies(state)
        .map((companyId) => ({ companyId, expectedPrice: priceFor(state, companyId) }))
        .filter((choice) => choice.expectedPrice <= cash)
}

export function canPassOpeningPurchase(state: State, playerId: string): boolean {
    return (
        state.machineState === 'BuyingOpeningCompanies' &&
        state.isActivePlayer(playerId) &&
        state.purchases.length > 0
    )
}

function updateOpeningOffer(state: State): void {
    const draft = state.draft
    assert(
        draft.kind === 'public' && draft.stage === 'buying',
        'Purchasing requires a public offer'
    )
    const remaining = unboughtOpeningCompanies(state)
    if (remaining.length === 1)
        draft.finalOffer = { cardId: remaining[0], price: priceFor(state, remaining[0]) }
}

function finishOpeningPurchase(state: State): void {
    if (unboughtOpeningCompanies(state).length) {
        nextDistributionPlayer(state)
        updateOpeningOffer(state)
        return
    }
    state.turnManager.endTurn(state.actionCount)
    state.turnManager.turnOrder = state.players.map((player) => player.playerId)
    state.activePlayerIds = [state.priorityDealPlayerId]
    state.turnManager.startTurn(state.priorityDealPlayerId, state.actionCount + 1)
    state.draft = { kind: 'public', stage: 'complete' }
    delete state.operatingSet
    state.machineState = 'StockRound'
}

export const BuyOpeningCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyOpeningCompany'),
        source: Type.Literal(ActionSource.User),
        companyId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(Purchase)
    },
    { additionalProperties: false }
)
const BuyValidator = Compile(BuyOpeningCompany)
export class BuyOpeningCompanyAction extends HydratableAction<typeof BuyOpeningCompany> {
    declare playerId: string
    declare companyId: string
    declare expectedPrice: number
    declare metadata?: Type.Static<typeof Purchase>
    constructor(data: Type.Static<typeof BuyOpeningCompany>) {
        super(data, BuyValidator)
    }
    isValid(state: State): boolean {
        return (
            this.source === ActionSource.User &&
            openingPurchaseChoices(state, this.playerId).some(
                (choice) =>
                    choice.companyId === this.companyId &&
                    choice.expectedPrice === this.expectedPrice
            )
        )
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Opening purchase must match a current affordable offer')
        const draft = state.draft
        assert(
            draft.kind === 'public' && draft.stage === 'buying',
            'Purchasing requires a public offer'
        )
        this.metadata = {
            playerId: this.playerId,
            cardId: this.companyId,
            price: this.expectedPrice
        }
        purchaseOpeningCompany(state, this.playerId, this.metadata)
        draft.passedPlayerIds = []
        delete draft.finalOffer
        finishOpeningPurchase(state)
    }
}

export const PassOpeningPurchase = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PassOpeningPurchase'),
        source: Type.Literal(ActionSource.User),
        metadata: Type.Optional(
            Type.Object(
                {
                    reducedOffer: Type.Optional(Selection),
                    purchase: Type.Optional(Purchase)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
const PassValidator = Compile(PassOpeningPurchase)
export class PassOpeningPurchaseAction extends HydratableAction<typeof PassOpeningPurchase> {
    declare playerId: string
    declare metadata?: Type.Static<typeof PassOpeningPurchase>['metadata']
    constructor(data: Type.Static<typeof PassOpeningPurchase>) {
        super(data, PassValidator)
    }
    isValid(state: State): boolean {
        return this.source === ActionSource.User && canPassOpeningPurchase(state, this.playerId)
    }
    apply(state: State): void {
        assert(this.isValid(state), 'The first opening purchase cannot be passed')
        const draft = state.draft
        assert(
            draft.kind === 'public' && draft.stage === 'buying',
            'Passing requires a public offer'
        )
        this.metadata = {}
        if (draft.finalOffer) {
            const offer = draft.finalOffer
            const floor = draftCompany(offer.cardId).debt
            assert(offer.price > floor, 'A free company must be taken')
            offer.price -= 10
            this.metadata.reducedOffer = { ...offer }
            nextDistributionPlayer(state)
            if (offer.price === floor) {
                const playerId = state.activePlayerIds[0]
                this.metadata.purchase = { ...offer, playerId }
                purchaseOpeningCompany(state, playerId, offer)
                finishOpeningPurchase(state)
            }
            return
        }
        draft.passedPlayerIds.push(this.playerId)
        if (draft.passedPlayerIds.length === 2) {
            state.turnManager.endTurn(state.actionCount)
            state.activePlayerIds = []
            state.draft = { kind: 'public', stage: 'operating' }
            state.machineState = 'PreparingOperatingSet'
        } else nextDistributionPlayer(state)
    }
}

const ResumeFields = Type.Object({
    type: Type.Literal('ResumeOpeningPurchases'),
    source: Type.Literal(ActionSource.System)
})
export const ResumeOpeningPurchases: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof ResumeFields.properties
> = Type.Object(
    {
        ...GameAction.properties,
        ...ResumeFields.properties
    },
    { additionalProperties: false }
)
const ResumeValidator = Compile(ResumeOpeningPurchases)
export class ResumeOpeningPurchasesAction extends HydratableAction<typeof ResumeOpeningPurchases> {
    constructor(data: Type.Static<typeof ResumeOpeningPurchases>) {
        super(data, ResumeValidator)
    }
    isValid(state: State): boolean {
        return (
            this.source === ActionSource.System &&
            state.draft.kind === 'public' &&
            state.draft.stage === 'operating' &&
            canStartStockRound(state)
        )
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Opening purchases resume after two operating rounds')
        assertExists(state.operatingSet)
        state.operatingSet.completed = true
        state.draft = { kind: 'public', stage: 'buying', passedPlayerIds: [] }
        state.turnManager.turnOrder = state.players.map((player) => player.playerId).toReversed()
        state.activePlayerIds = [state.turnManager.turnOrder[0]]
        state.turnManager.startTurn(state.activePlayerIds[0], state.actionCount + 1)
        updateOpeningOffer(state)
    }
}

export const PublicDistributionActions = [
    defineAction(
        BuyOpeningCompany,
        (action): action is Type.Static<typeof BuyOpeningCompany> => BuyValidator.Check(action),
        (data) => new BuyOpeningCompanyAction(data)
    ),
    defineAction(
        PassOpeningPurchase,
        (action): action is Type.Static<typeof PassOpeningPurchase> => PassValidator.Check(action),
        (data) => new PassOpeningPurchaseAction(data)
    ),
    defineAction(
        ResumeOpeningPurchases,
        (action): action is Type.Static<typeof ResumeOpeningPurchases> =>
            ResumeValidator.Check(action),
        (data) => new ResumeOpeningPurchasesAction(data)
    )
]

export const buyingOpeningCompaniesHandler: MachineStateHandler<
    BuyOpeningCompanyAction | PassOpeningPurchaseAction,
    State
> = {
    enter() {},
    validActionsForPlayer(playerId, { gameState }) {
        return [
            ...(openingPurchaseChoices(gameState, playerId).length ? ['BuyOpeningCompany'] : []),
            ...(canPassOpeningPurchase(gameState, playerId) ? ['PassOpeningPurchase'] : [])
        ]
    },
    isValidAction(action, { gameState }) {
        return (
            (action instanceof BuyOpeningCompanyAction ||
                action instanceof PassOpeningPurchaseAction) &&
            action.isValid(gameState)
        )
    },
    onAction(_action, { gameState }) {
        return gameState.machineState
    }
}
