import {
    BidForChoice,
    BuyPrivateFromBank,
    ChooseCertificate,
    LayHomeTile,
    LayingHomeTileState,
    PassForChoice,
    PrivateCatalog1860,
    PrivateSaleCommission,
    ReturnTrain,
    SellPrivateToBank,
    TitleRules1860,
    TrackRules1860,
    TrainRules1860,
    auctionDecision,
    canBid,
    company1860,
    companyOverLimit,
    lotChoices,
    maximumBid,
    minimumBid,
    buyablePrivates,
    sellablePrivates,
    type HydratedState1860,
    type State1860
} from '@tabletop/1860'
import {
    TrackConstruction,
    trainsOverLimit,
    type TrackLayDetails,
    type Train
} from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    createEighteenXXSessionClass,
    type AwaitedDecision,
    type TitleTrackLay
} from '@tabletop/18xx-ui'
import { MapView1860 } from './mapView.js'
import { Presentation1860 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'
import { stagedChoices } from './stagedChoices.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1860, HydratedState1860>
> = createEighteenXXSessionClass<typeof State1860, HydratedState1860>(
    TitleRules1860,
    MapView1860,
    Presentation1860,
    createRouteWorker
)

/** A private the bank buys or sells in the stock round, and what it pays or asks. */
export type BankPrivateOffer = { privateCompanyId: string; amount: number }

export class Session1860 extends BaseSession {
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        for (const selection of stagedChoices(this)) this.localSelections.register(selection)
    }
    // Whether the decision is this player's, even while their Action is sent or presented: its
    // panel stays up, its controls disabled by `canChooseAction`.
    private readonly deciding = $derived(this.isPlayable && this.isMyTurn && !this.isViewingHistory)
    readonly canChooseAction = $derived(this.deciding && !this.busy && !this.updatingVisibleState)
    private readonly me = $derived(this.myPlayer?.id)
    private can(type: string): boolean {
        return this.deciding && this.validActionTypes.includes(type)
    }

    // The initial auction (Private Companies and the Initial Auction).
    readonly auctionDecision = $derived(auctionDecision(this.gameState))
    readonly myAuctionTurn = $derived(
        !!this.me && this.auctionDecision?.playerId === this.me && this.deciding
    )
    bidAmount = $state<number>()
    chosenLot = $state<string>()
    readonly minimumBid = $derived(
        this.gameState.choiceAuction ? minimumBid(this.gameState.choiceAuction) : 0
    )
    readonly maximumBid = $derived(
        this.me && this.auctionDecision?.kind === 'bid' && this.auctionDecision.playerId === this.me
            ? maximumBid(this.gameState, this.me)
            : 0
    )
    mayBid(amount: number): boolean {
        return (
            !!this.me &&
            this.auctionDecision?.kind === 'bid' &&
            canBid(this.gameState, this.me, amount)
        )
    }
    /** The certificates the auction's winner may take, with the pars a director's share may take. */
    readonly lotChoices = $derived(
        this.me &&
            this.auctionDecision?.kind === 'choose' &&
            this.auctionDecision.playerId === this.me
            ? lotChoices(this.gameState, this.me)
            : []
    )
    async bid(amount: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(BidForChoice, { amount }))
    }
    async passBid(): Promise<void> {
        await this.applyAction(this.createPlayerAction(PassForChoice, {}))
    }
    async chooseCertificate(lotId: string, parPrice?: number): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(ChooseCertificate, {
                lotId,
                ...(parPrice !== undefined ? { parPrice } : {})
            })
        )
    }

    // Privates bought from and sold to the bank in the stock round (Selling Private Companies;
    // The Fishbourne Ferry Company).
    readonly privateSales = $derived.by((): BankPrivateOffer[] =>
        this.me && this.can('SellPrivateToBank')
            ? sellablePrivates(this.gameState, this.me).map((privateCompanyId) => ({
                  privateCompanyId,
                  amount: PrivateCatalog1860.faceValue(privateCompanyId) - PrivateSaleCommission
              }))
            : []
    )
    readonly privatePurchases = $derived.by((): BankPrivateOffer[] =>
        this.me && this.can('BuyPrivateFromBank')
            ? buyablePrivates(this.gameState, this.me).map((privateCompanyId) => ({
                  privateCompanyId,
                  amount: PrivateCatalog1860.faceValue(privateCompanyId)
              }))
            : []
    )
    readonly stockPanels = this.titleStockPanels<'privates'>([
        {
            id: 'privates',
            label: 'Privates',
            available: () =>
                this.gameState.machineState === 'StockRound' &&
                (this.privateSales.length > 0 || this.privatePurchases.length > 0)
        }
    ])
    async sellPrivateToBank(privateCompanyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(SellPrivateToBank, { privateCompanyId }))
    }
    async buyPrivateFromBank(privateCompanyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(BuyPrivateFromBank, { privateCompanyId }))
    }

    // A floating company's home tile, laid on the map as any tile is (Flotation & Capitalisation).
    readonly homeTileCompanyId = $derived(
        this.gameState.machineState === LayingHomeTileState
            ? this.gameState.homeTileCompanyId
            : undefined
    )
    private readonly homeTileLay = $derived.by((): TitleTrackLay | undefined => {
        const companyId = this.homeTileCompanyId
        if (!companyId || !this.deciding || !this.validActionTypes.includes('LayHomeTile'))
            return undefined
        const home = company1860(companyId).home
        const construction = new TrackConstruction(
            { ...this.gameState, trackStep: { companyId, lays: [], completed: false } },
            TrackRules1860
        )
        return {
            construction: {
                choices: (locationId) =>
                    locationId === home ? construction.choices(locationId) : [],
                hasChoice: (locationId) =>
                    locationId === home && construction.hasChoice(locationId),
                canReach: (locationId) => locationId === home,
                evaluate: (request) => construction.evaluate(request),
                inventoryAfter: (details) => construction.inventoryAfter(details),
                stationsAfter: (details) => construction.stationsAfter(details)
            },
            commit: (details) => this.layHomeTile(details)
        }
    })
    protected override get titleTrackLay(): TitleTrackLay | undefined {
        return this.homeTileLay
    }
    private async layHomeTile(details: TrackLayDetails): Promise<void> {
        const { companyId, locationId, definitionId, rotation, nodeMapping } = details
        await this.applyAction(
            this.createPlayerAction(LayHomeTile, {
                companyId,
                locationId,
                definitionId,
                rotation,
                nodeMapping
            })
        )
    }

    // Trains over the limit, returned as the company's turn begins (Buying Trains).
    readonly trainReturn = $derived.by(
        (): { companyId: string; trains: readonly Train[] } | undefined => {
            const companyId = companyOverLimit(this.gameState)
            if (!companyId || !this.can('ReturnTrain')) return undefined
            return {
                companyId,
                trains: trainsOverLimit(this.gameState, TrainRules1860, companyId)
            }
        }
    )
    async returnTrain(trainId: string): Promise<void> {
        const companyId = this.trainReturn?.companyId
        assertExists(companyId, 'A company is over its train limit')
        await this.applyAction(this.createPlayerAction(ReturnTrain, { companyId, trainId }))
    }

    protected override titleAwaitedDecision(state: HydratedState1860): AwaitedDecision | undefined {
        const name = (playerId: string) => this.getPlayerName(playerId)
        const auction = auctionDecision(state)
        if (auction)
            return {
                title: 'Initial auction',
                text:
                    auction.kind === 'choose'
                        ? `${name(auction.playerId)} chooses a certificate`
                        : `${name(auction.playerId)} may bid or pass`
            }
        const homeCompanyId =
            state.machineState === LayingHomeTileState ? state.homeTileCompanyId : undefined
        if (homeCompanyId) {
            const playerId = state.activePlayerIds[0]
            return {
                title: 'Home tile',
                companyId: homeCompanyId,
                text: `${playerId ? name(playerId) : 'The director'} lays ${this.companyName(homeCompanyId)}’s home tile`
            }
        }
        const overLimit =
            state.machineState === 'ReturningTrains' ? companyOverLimit(state) : undefined
        if (overLimit) {
            const playerId = state.activePlayerIds[0]
            return {
                title: 'Train limit',
                companyId: overLimit,
                text: `${playerId ? name(playerId) : 'The director'} returns a train of ${this.companyName(overLimit)} to the bank`
            }
        }
        return undefined
    }
}

export function requireSession1860(
    session: GameSession<State1860, HydratedState1860>
): Session1860 {
    assert(session instanceof Session1860, '1860 requires its title session')
    return session
}
