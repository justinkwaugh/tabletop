import {
    assert,
    assertExists,
    AuctionType,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimultaneousAuction,
    HydratedTurnManager,
    PrngState,
    SimultaneousAuction,
    TieResolutionStrategy,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { MarketColor } from '../definition/marketColor.js'
import { AntiqueDeck, HydratedAntiqueDeck } from '../components/antiques.js'
import {
    fountainsNextToShop,
    FountainIds,
    getShop,
    ShopIds,
    type FountainId,
    type ShopId
} from '../components/board.js'
import {
    auctioneerCut,
    customerPayment,
    MaxShopsPerPlayer,
    MinimumAuctionBid
} from '../components/payments.js'
import { HydratedMarracashPlayerState, MarracashPlayerState } from './playerState.js'

export enum TurnAction {
    Auction = 'auction'
}

export const ActionsPerTurn = 2

export type ShopState = Type.Static<typeof ShopState>
export const ShopState = Type.Object({
    shopId: Type.Enum(ShopIds),
    ownerId: Type.Optional(Type.String()),
    customers: Type.Number()
})

export type FountainState = Type.Static<typeof FountainState>
export const FountainState = Type.Object({
    fountainId: Type.Enum(FountainIds),
    visitors: Type.Array(Type.Enum(MarketColor))
})

export type PullIn = Type.Static<typeof PullIn>
export const PullIn = Type.Object({
    fountainId: Type.Enum(FountainIds),
    customers: Type.Number(),
    income: Type.Number()
})

export type AuctionResult = Type.Static<typeof AuctionResult>
export const AuctionResult = Type.Object({
    shopId: Type.Enum(ShopIds),
    winnerId: Type.String(),
    price: Type.Number(),
    auctioneerCut: Type.Number(),
    pullIns: Type.Array(PullIn)
})

export type MarracashGameState = Type.Static<typeof MarracashGameState>
export const MarracashGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(MarracashPlayerState),
            machineState: Type.Enum(MachineState),
            shops: Type.Array(ShopState),
            fountains: Type.Array(FountainState),
            queue: Type.Array(Type.Enum(MarketColor)),
            antiqueDeck: AntiqueDeck,
            round: Type.Number(),
            turnActions: Type.Array(Type.Enum(TurnAction)),
            auction: Type.Optional(SimultaneousAuction),
            auctionShopId: Type.Optional(Type.Enum(ShopIds))
        })
    ])
)

export const MarracashGameStateValidator = Compile(MarracashGameState)

export const MarracashProjectedState = Visibility.createProjectionSchema(MarracashGameState)
export type MarracashProjectedState = Type.Static<typeof MarracashProjectedState>
const MarracashProjectedStateValidator = Compile(MarracashProjectedState)

export class HydratedMarracashGameState extends HydratableGameState<
    typeof MarracashProjectedState,
    HydratedMarracashPlayerState
> {
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMarracashPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare shops: ShopState[]
    declare fountains: FountainState[]
    declare queue: MarketColor[]
    declare antiqueDeck: HydratedAntiqueDeck
    declare round: number
    declare turnActions: TurnAction[]
    declare auction?: HydratedSimultaneousAuction
    declare auctionShopId?: ShopId

    constructor(data: MarracashProjectedState) {
        super(data, MarracashProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedMarracashPlayerState(player))
        this.antiqueDeck = new HydratedAntiqueDeck(data.antiqueDeck)
        if (data.auction) {
            this.auction = new HydratedSimultaneousAuction(data.auction)
        }
    }

    getShopState(shopId: ShopId): ShopState {
        const shop = this.shops.find((candidate) => candidate.shopId === shopId)
        assertExists(shop, `No state for shop ${shopId}`)
        return shop
    }

    getFountainState(fountainId: FountainId): FountainState {
        const fountain = this.fountains.find((candidate) => candidate.fountainId === fountainId)
        assertExists(fountain, `No state for fountain ${fountainId}`)
        return fountain
    }

    ownedShopCount(playerId: string): number {
        return this.shops.filter((shop) => shop.ownerId === playerId).length
    }

    hasUnownedShop(): boolean {
        return this.shops.some((shop) => shop.ownerId === undefined)
    }

    canTakeTurnAction(): boolean {
        return this.round === 1
            ? this.turnActions.length === 0
            : this.turnActions.length < ActionsPerTurn
    }

    canStartAuction(playerId: string): boolean {
        return (
            this.canTakeTurnAction() &&
            this.hasUnownedShop() &&
            this.ownedShopCount(playerId) < MaxShopsPerPlayer &&
            this.getPlayerState(playerId).getMoney() >= MinimumAuctionBid
        )
    }

    startAuction(auctionId: string, auctioneerId: string, shopId: ShopId) {
        assert(this.getShopState(shopId).ownerId === undefined, `Shop ${shopId} is already owned`)
        const order = this.turnManager.turnOrder
        const auctioneerIndex = order.indexOf(auctioneerId)
        const clockwiseFromAuctioneer = [
            ...order.slice(auctioneerIndex),
            ...order.slice(0, auctioneerIndex)
        ]

        this.auction = new HydratedSimultaneousAuction({
            id: auctionId,
            type: AuctionType.Simultaneous,
            participants: clockwiseFromAuctioneer.map((playerId) => ({
                playerId,
                passed: false,
                submitted: false
            })),
            auctioneerId,
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        })
        this.auctionShopId = shopId
        this.turnActions.push(TurnAction.Auction)
    }

    resolveAuction(): AuctionResult {
        const auction = this.auction
        const shopId = this.auctionShopId
        assertExists(auction, 'No auction to resolve')
        assertExists(shopId, 'No shop is being auctioned')
        assertExists(auction.winnerId, 'The auction has no winner yet')
        assertExists(auction.highBid, 'The auction has no winning bid')
        assertExists(auction.auctioneerId, 'The auction has no auctioneer')

        const winner = this.getPlayerState(auction.winnerId)
        winner.money = winner.getMoney() - auction.highBid
        const cut = auction.winnerId === auction.auctioneerId ? 0 : auctioneerCut(auction.highBid)
        if (cut > 0) {
            const auctioneer = this.getPlayerState(auction.auctioneerId)
            auctioneer.money = auctioneer.getMoney() + cut
        }

        this.getShopState(shopId).ownerId = auction.winnerId
        const pullIns = this.pullInCustomers(shopId)

        this.auction = undefined
        this.auctionShopId = undefined

        return {
            shopId,
            winnerId: auction.winnerId,
            price: auction.highBid,
            auctioneerCut: cut,
            pullIns
        }
    }

    endTurn() {
        const endedTurn = this.turnManager.endTurn(this.actionCount)
        this.turnActions = []
        if (endedTurn.playerId === this.turnManager.turnOrder.at(-1)) {
            this.round += 1
        }
    }

    private pullInCustomers(shopId: ShopId): PullIn[] {
        const color = getShop(shopId).color
        const pullIns: PullIn[] = []
        for (const fountainId of fountainsNextToShop(shopId)) {
            const fountain = this.getFountainState(fountainId)
            const matching = fountain.visitors.filter((visitor) => visitor === color).length
            if (matching === 0) {
                continue
            }
            fountain.visitors = fountain.visitors.filter((visitor) => visitor !== color)
            pullIns.push({
                fountainId,
                customers: matching,
                income: this.addCustomers(shopId, matching)
            })
        }
        return pullIns
    }

    private addCustomers(shopId: ShopId, count: number): number {
        const shop = this.getShopState(shopId)
        assertExists(shop.ownerId, `Shop ${shopId} has no owner to pay`)
        let income = 0
        for (let added = 0; added < count; added++) {
            shop.customers += 1
            income += customerPayment(shop.customers)
        }
        const owner = this.getPlayerState(shop.ownerId)
        owner.money = owner.getMoney() + income
        return income
    }
}
