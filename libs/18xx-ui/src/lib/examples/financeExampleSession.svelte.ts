import { GameSession } from '@tabletop/frontend-components'
import { assert, assertExists, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    BuyShares,
    isBuyShares,
    evaluateSharePurchase,
    requireFinanceExampleState,
    type PurchaseRequest,
    type SharePurchaseRules
} from '@tabletop/18xx'

type SessionOptions = ConstructorParameters<typeof GameSession<GameState, HydratedGameState>>[0]
export class FinanceExampleSession extends GameSession<GameState, HydratedGameState> {
    selection: PurchaseRequest | undefined = $state()
    constructor(
        options: SessionOptions,
        private readonly purchaseRules: SharePurchaseRules
    ) {
        super(options)
    }
    financialState = $derived(requireFinanceExampleState(this.gameState))
    purchaseChoices = $derived.by(() => {
        const state = this.financialState
        const playerId = this.myPlayer?.id
        if (
            !playerId ||
            this.updatingVisibleState ||
            this.isViewingHistory ||
            !this.validActionTypes.includes('BuyShares')
        )
            return []
        return this.purchaseRules.buyers(state, playerId).flatMap((buyer) =>
            state.certificates
                .filter((certificate) => !certificate.retired)
                .filter((certificate) => certificate.kind === 'share')
                .filter((certificate) => certificate.poolId !== undefined)
                .map((certificate) => {
                    const request = { playerId, buyer, certificateId: certificate.id }
                    return {
                        certificate,
                        request,
                        result: evaluateSharePurchase(state, request, this.purchaseRules)
                    }
                })
        )
    })
    selectedPurchaseDetails = $derived.by(() => {
        if (!this.selection || this.updatingVisibleState || this.isViewingHistory) return undefined
        return evaluateSharePurchase(this.financialState, this.selection, this.purchaseRules)
            .details
    })
    purchases = $derived(this.actions.slice(0, this.gameState.actionCount).filter(isBuyShares))
    selectPurchase(request: PurchaseRequest) {
        assert(!this.busy && !this.isViewingHistory, 'Purchase selection is unavailable')
        assert(request.playerId === this.myPlayer?.id, 'Select a purchase for the acting player')
        assert(
            evaluateSharePurchase(this.financialState, request, this.purchaseRules).details,
            'Purchase is unavailable'
        )
        this.selection = request
    }
    cancelPurchase() {
        this.selection = undefined
    }
    async confirmPurchase() {
        assert(!this.busy && !this.isViewingHistory, 'Purchase is unavailable')
        const details = this.selectedPurchaseDetails
        assertExists(details, 'Select an available purchase')
        await this.applyAction(
            this.createPlayerAction(BuyShares, {
                buyer: details.buyer,
                certificateId: details.certificateId,
                expectedPrice: details.price
            })
        )
    }
    override beforeNewState() {
        this.cancelPurchase()
    }
    override async undo() {
        if (this.busy || this.isViewingHistory) return
        if (this.selection) {
            this.cancelPurchase()
            return
        }
        await super.undo()
    }
}
export function createFinanceExampleSessionClass(
    rules: SharePurchaseRules
): new (options: SessionOptions) => FinanceExampleSession {
    return class extends FinanceExampleSession {
        constructor(options: SessionOptions) {
            super(options, rules)
        }
    }
}
export function requireFinanceExampleSession(
    session: GameSession<GameState, HydratedGameState>
): FinanceExampleSession {
    assert(session instanceof FinanceExampleSession, 'Expected a finance example session')
    return session
}
