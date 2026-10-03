import { assert } from '@tabletop/common'
import {
    BidForLot,
    NominateLot,
    PassSelectionAuction,
    SelectionAuctionModel,
    type EighteenXXTitleRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type SelectionAuctionSession = ModuleSession<
    SelectionAuctionState & { machineState: string },
    Pick<EighteenXXTitleRules, 'selectionAuctionRules'>
>
export type SelectionAuctionChoice = { lotId: string; amount: number }

export class SelectionAuctionModule {
    readonly choice = singleChoice<SelectionAuctionChoice>()
    constructor(private readonly session: SelectionAuctionSession) {}

    model = $derived.by(() =>
        this.session.state.selectionAuction && this.session.rules.selectionAuctionRules
            ? new SelectionAuctionModel(
                  this.session.state,
                  this.session.rules.selectionAuctionRules
              )
            : undefined
    )
    active = $derived.by(() => !!this.model && !this.model.auction.completed)
    selection = $derived.by(() =>
        !this.session.selectionsVisible || !this.active ? undefined : this.choice.value('choice')
    )
    canAct = $derived.by(
        () =>
            this.session.interactive &&
            ['PassSelectionAuction', 'NominateLot', 'BidForLot'].some((type) =>
                this.session.validActionTypes.includes(type)
            )
    )
    canPass = $derived.by(
        () => this.canAct && this.session.validActionTypes.includes('PassSelectionAuction')
    )
    /** The player whose nomination, bid or pass the auction awaits. */
    playerId = $derived.by(() => (this.active ? this.model?.playerId : undefined))

    canNominate(lotId: string, amount: number): boolean {
        const model = this.model
        return (
            this.canAct &&
            !!model &&
            !!this.playerId &&
            model.canNominate(this.playerId, lotId, amount)
        )
    }
    canBid(amount: number): boolean {
        const model = this.model
        const lotId = model?.auction.bidding?.lotId
        return (
            this.canAct &&
            !!model &&
            !!lotId &&
            !!this.playerId &&
            model.canBid(this.playerId, lotId, amount)
        )
    }
    select(lotId: string) {
        assert(this.canAct && this.model, 'Auction selection is unavailable')
        this.choice.choose('choice', { lotId, amount: this.model.minimumBid(lotId) })
    }
    setBid(amount: number) {
        const choice = this.choice.value('choice')
        assert(this.canAct && choice, 'Select a lot first')
        this.choice.choose('choice', { ...choice, amount })
    }
    async nominate() {
        const selection = this.selection
        assert(this.canAct && selection && !this.model?.auction.bidding, 'Select a lot and bid')
        await this.session.applyAction(
            this.session.createPlayerAction(NominateLot, {
                lotId: selection.lotId,
                amount: selection.amount
            })
        )
    }
    async bid(amount: number) {
        const lotId = this.model?.auction.bidding?.lotId
        assert(this.canAct && lotId, 'No lot is being auctioned')
        this.choice.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(BidForLot, { lotId, amount })
        )
    }
    async pass() {
        assert(this.canPass, 'Passing is unavailable')
        this.choice.clear()
        await this.session.applyAction(this.session.createPlayerAction(PassSelectionAuction, {}))
    }
}
