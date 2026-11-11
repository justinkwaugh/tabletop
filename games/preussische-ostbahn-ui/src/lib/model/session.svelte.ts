import { GameSession, undoableStagedSelection } from '@tabletop/frontend-components'
import {
    BuildTrack,
    Capitalize,
    EndExpansion,
    HydratedOstbahnGameState,
    MachineState,
    PassBid,
    PassTurn,
    PlaceBid,
    type OstbahnGameState,
    type RailroadId,
    type ShareAuctionKind
} from '@tabletop/preussische-ostbahn'
import type { AuctionParticipant } from '@tabletop/common'
import {
    TurnIntent,
    TurnStageOrder,
    chooseIntent,
    chooseRailroad,
    type TurnSelection
} from './selection.js'

type SessionOptions = ConstructorParameters<
    typeof GameSession<OstbahnGameState, HydratedOstbahnGameState>
>[0]

export type ShareAuctionView = {
    railroadId: RailroadId
    kind: ShareAuctionKind
    openerId: string | undefined
    seats: AuctionParticipant[]
    highBid: number | undefined
    highBidderId: string | undefined
    currentBidderId: string | undefined
    smallestBid: number
}

export type ExpansionTarget = {
    spaceId: string
    cost: number
}

export type TurnSlotView = {
    playerId: string
    done: boolean
    current: boolean
}

export class OstbahnGameSession extends GameSession<OstbahnGameState, HydratedOstbahnGameState> {
    private turnSelection: TurnSelection = $state({})

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                TurnStageOrder,
                () => this.turnSelection,
                (selection) => (this.turnSelection = selection)
            )
        )
    }

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && !this.gameState.result)

    private actingIn(...states: MachineState[]): boolean {
        return this.canAct && states.includes(this.gameState.machineState)
    }

    playerInitial(playerId: string): string {
        return this.getPlayerName(playerId).charAt(0).toUpperCase()
    }

    displayName(playerId: string): string {
        return playerId === this.myPlayerId ? 'You' : this.getPlayerName(playerId)
    }

    choosingAction = $derived(this.actingIn(MachineState.ChoosingAction))
    bidding = $derived(this.actingIn(MachineState.ShareBidding))

    expandableRailroads: RailroadId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.choosingAction ? this.gameState.expandableRailroads(playerId) : []
    })

    capitalizableRailroads: RailroadId[] = $derived(
        this.choosingAction ? this.gameState.capitalizableRailroads() : []
    )

    expanding = $derived(this.actingIn(MachineState.Expanding))

    intent: TurnIntent | undefined = $derived(
        this.choosingAction ? this.turnSelection.intent?.value : undefined
    )

    expansionRailroad: RailroadId | undefined = $derived.by(() => {
        if (this.expanding) {
            return this.gameState.expansion?.railroadId
        }
        if (this.intent !== TurnIntent.Build) {
            return undefined
        }
        const chosen = this.turnSelection.railroad?.value
        if (chosen && this.expandableRailroads.includes(chosen)) {
            return chosen
        }
        return this.expandableRailroads.length === 1 ? this.expandableRailroads[0] : undefined
    })

    chooseIntent(intent: TurnIntent) {
        const available =
            intent === TurnIntent.Build
                ? this.expandableRailroads.length > 0
                : this.capitalizableRailroads.length > 0
        if (this.choosingAction && available) {
            this.turnSelection = chooseIntent(this.turnSelection, intent)
        }
    }

    expansionTargets: ExpansionTarget[] = $derived.by(() => {
        const railroadId = this.expansionRailroad
        if (!railroadId) {
            return []
        }
        return this.gameState.buildChoices(railroadId).map((spaceId) => ({
            spaceId,
            cost: this.gameState.trackCharge(railroadId, spaceId)
        }))
    })

    chooseExpansionRailroad(railroadId: RailroadId) {
        if (this.intent === TurnIntent.Build && this.expandableRailroads.includes(railroadId)) {
            this.turnSelection = chooseRailroad(this.turnSelection, railroadId)
        }
    }

    async chooseSpace(spaceId: string) {
        const railroadId = this.expansionRailroad
        if (railroadId && this.expansionTargets.some((target) => target.spaceId === spaceId)) {
            await this.applyAction(this.createPlayerAction(BuildTrack, { railroadId, spaceId }))
        }
    }

    async endExpansion() {
        if (this.expanding) {
            await this.applyAction(this.createPlayerAction(EndExpansion, {}))
        }
    }

    async capitalize(railroadId: RailroadId) {
        if (this.capitalizableRailroads.includes(railroadId)) {
            await this.applyAction(this.createPlayerAction(Capitalize, { railroadId }))
        }
    }

    async passTurn() {
        if (this.choosingAction) {
            await this.applyAction(this.createPlayerAction(PassTurn, {}))
        }
    }

    shareAuctionView: ShareAuctionView | undefined = $derived.by(() => {
        const auction = this.gameState.shareAuction
        if (!auction) {
            return undefined
        }
        const bidding = this.gameState.bidding()
        return {
            railroadId: auction.railroadId,
            kind: auction.kind,
            openerId: auction.bidding.auctioneerId,
            seats: auction.bidding.participants,
            highBid: bidding.hasBid ? bidding.highBid : undefined,
            highBidderId: bidding.hasBid ? bidding.highBidderId : undefined,
            currentBidderId: bidding.currentBidderId,
            smallestBid: this.gameState.smallestBid()
        }
    })

    async placeBid(amount: number) {
        if (this.bidding) {
            await this.applyAction(this.createPlayerAction(PlaceBid, { amount }))
        }
    }

    async passBid() {
        if (this.bidding) {
            await this.applyAction(this.createPlayerAction(PassBid, {}))
        }
    }

    turnSlots: TurnSlotView[] = $derived.by(() => {
        const state = this.gameState
        const choosing =
            state.machineState === MachineState.ChoosingAction ||
            state.machineState === MachineState.Expanding ||
            state.machineState === MachineState.PayingDividends ||
            (state.machineState === MachineState.ShareBidding && state.rounds.series.length > 0)
        return state.turnSlots.map((playerId, index) => ({
            playerId,
            done: index < state.slotIndex,
            current: choosing && index === state.slotIndex
        }))
    })
}
