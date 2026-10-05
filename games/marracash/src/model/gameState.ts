import {
    assert,
    assertExists,
    AuctionType,
    CardinalDirection,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimultaneousAuction,
    HydratedTurnManager,
    PrngState,
    TieResolutionStrategy,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { MarracashGameConfig } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import { emptyColorCounts, MarketColor } from '../definition/marketColor.js'
import {
    Antique,
    AntiqueDeck,
    AntiquesPerPlayer,
    antiqueSetPayout,
    coversAntiqueSet,
    HydratedAntiqueDeck
} from '../components/antiques.js'
import {
    EntranceFountainIds,
    fountainsNextToShop,
    FountainIds,
    getShop,
    routeFrom,
    shopVisits,
    ShopIds,
    type FountainId,
    type Route,
    type RouteOutcome,
    type ShopId
} from '../components/board.js'
import {
    auctioneerCut,
    customerPayment,
    MaxShopsPerPlayer,
    MinimumAuctionBid,
    moverCut
} from '../components/payments.js'
import { HydratedShopAuction, ShopAuction } from '../components/shopAuction.js'
import { isValidVisitorCount, QueueEnd } from '../components/visitors.js'
import { HydratedMarracashPlayerState, MarracashPlayerState } from './playerState.js'

export enum TurnAction {
    Auction = 'auction',
    Move = 'move'
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

export type RevealedBid = Type.Static<typeof RevealedBid>
export const RevealedBid = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

export type AuctionResult = Type.Static<typeof AuctionResult>
export const AuctionResult = Type.Object({
    shopId: Type.Enum(ShopIds),
    bids: Type.Array(RevealedBid),
    winnerId: Type.String(),
    price: Type.Number(),
    auctioneerCut: Type.Number(),
    pullIns: Type.Array(PullIn)
})

// Bids are recorded clockwise from the auctioneer, who must bid and so never passes.
export function auctioneerOf(result: AuctionResult): string {
    const first = result.bids[0]
    assertExists(first, 'An auction result has no bids')
    return first.playerId
}

export function tiedBidderIds(result: AuctionResult): string[] {
    const tied = result.bids.filter((bid) => bid.amount === result.price)
    return tied.length > 1 ? tied.map((bid) => bid.playerId) : []
}

export type ShopEntry = Type.Static<typeof ShopEntry>
export const ShopEntry = Type.Object({
    shopId: Type.Enum(ShopIds),
    ownerId: Type.String(),
    customers: Type.Number(),
    income: Type.Number(),
    moverCut: Type.Number()
})

export type MoveResult = Type.Static<typeof MoveResult>
export const MoveResult = Type.Object({
    destinationId: Type.Enum(FountainIds),
    entries: Type.Array(ShopEntry),
    arrivals: Type.Array(Type.Enum(MarketColor))
})

export type AntiqueSetResult = Type.Static<typeof AntiqueSetResult>
export const AntiqueSetResult = Type.Object({
    cards: Type.Array(Antique),
    rank: Type.Number(),
    payout: Type.Number()
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
            antiqueCards: Type.Boolean(),
            antiqueDeck: AntiqueDeck,
            round: Type.Number(),
            turnActions: Type.Array(Type.Enum(TurnAction)),
            auction: Type.Optional(ShopAuction),
            finalRound: Type.Boolean(),
            pendingAntiqueSets: Visibility.protect(Type.Array(Type.String()), {
                policy: Visibility.Policy.HostOnly,
                redaction: Visibility.redaction.emptyArray()
            }),
            antiqueRevealOrder: Type.Array(Type.String()),
            // Absent from games started under 0.1.0, which keep their confirmation step and wider
            // Undo barriers so that their recorded Actions still replay the same way.
            undoStopsOnlyAtReveals: Type.Optional(Type.Literal(true))
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
    declare antiqueCards: boolean
    declare antiqueDeck: HydratedAntiqueDeck
    declare round: number
    declare turnActions: TurnAction[]
    declare auction?: HydratedShopAuction
    declare finalRound: boolean
    declare pendingAntiqueSets: string[]
    declare antiqueRevealOrder: string[]
    declare undoStopsOnlyAtReveals?: true

    constructor(data: MarracashProjectedState) {
        super(data, MarracashProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedMarracashPlayerState(player))
        this.antiqueDeck = new HydratedAntiqueDeck(data.antiqueDeck)
        if (data.auction) {
            this.auction = new HydratedShopAuction(data.auction)
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

    isAtShopLimit(playerId: string): boolean {
        return this.ownedShopCount(playerId) >= MaxShopsPerPlayer
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
            !this.isAtShopLimit(playerId) &&
            this.getPlayerState(playerId).getMoney() >= MinimumAuctionBid
        )
    }

    minimumBid(playerId: string): number {
        return playerId === this.auction?.bidding.auctioneerId ? MinimumAuctionBid : 0
    }

    hasVisitorsToMove(): boolean {
        return this.fountains.some((fountain) => fountain.visitors.length > 0)
    }

    canMoveVisitorsFrom(fountainId: FountainId, direction: CardinalDirection): boolean {
        return (
            this.canMoveVisitors() &&
            this.getFountainState(fountainId).visitors.length > 0 &&
            routeFrom(fountainId, direction) !== undefined
        )
    }

    canAuctionShop(playerId: string, shopId: ShopId): boolean {
        return this.canStartAuction(playerId) && this.getShopState(shopId).ownerId === undefined
    }

    canMoveVisitors(): boolean {
        return (
            this.round > 1 &&
            this.canTakeTurnAction() &&
            !this.turnActions.includes(TurnAction.Auction) &&
            this.hasVisitorsToMove()
        )
    }

    visitsAlong(route: Route): RouteOutcome {
        return shopVisits(
            route,
            this.getFountainState(route.from).visitors,
            (shopId) => this.getShopState(shopId).ownerId !== undefined
        )
    }

    moveVisitors(
        moverId: string,
        fountainId: FountainId,
        direction: CardinalDirection
    ): MoveResult {
        const route = routeFrom(fountainId, direction)
        assertExists(route, `No route leaves fountain ${fountainId} heading ${direction}`)
        const origin = this.getFountainState(fountainId)
        assert(origin.visitors.length > 0, `Fountain ${fountainId} has no visitors to move`)

        const { visits, arrivals } = this.visitsAlong(route)
        origin.visitors = []
        const entries: ShopEntry[] = []
        for (const { shopId, customers } of visits) {
            const ownerId = this.getShopState(shopId).ownerId
            assertExists(ownerId, `Shop ${shopId} has no owner`)
            const income = this.addCustomers(shopId, customers)
            const cut = ownerId === moverId ? 0 : moverCut(income, customers)
            this.transferMoney(ownerId, moverId, cut)
            entries.push({ shopId, ownerId, customers, income, moverCut: cut })
        }

        this.getFountainState(route.to).visitors.push(...arrivals)
        this.turnActions.push(TurnAction.Move)
        return { destinationId: route.to, entries, arrivals }
    }

    completeAntiqueSet(collectorId: string): AntiqueSetResult {
        assert(
            this.isNextAntiqueSet(collectorId),
            `Player ${collectorId} is not next to complete an antique set`
        )
        const collector = this.getPlayerState(collectorId)
        const cards = collector.antiques
        const rank = this.antiqueRevealOrder.length
        const payout = antiqueSetPayout(cards, rank)

        collector.revealedAntiques = cards
        collector.antiques = []
        collector.adjustMoney(payout)
        this.pendingAntiqueSets.shift()
        this.antiqueRevealOrder.push(collectorId)
        return { cards, rank, payout }
    }

    startAuction(auctionId: string, auctioneerId: string, shopId: ShopId) {
        assert(this.getShopState(shopId).ownerId === undefined, `Shop ${shopId} is already owned`)
        const order = this.turnManager.turnOrder
        const auctioneerIndex = order.indexOf(auctioneerId)
        const clockwiseFromAuctioneer = [
            ...order.slice(auctioneerIndex),
            ...order.slice(0, auctioneerIndex)
        ]

        this.auction = new HydratedShopAuction({
            shopId,
            bidding: new HydratedSimultaneousAuction({
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
        })
        this.turnActions.push(TurnAction.Auction)
    }

    resolveAuction(): AuctionResult {
        assertExists(this.auction, 'No auction to resolve')
        const { shopId, bidding: auction } = this.auction
        assertExists(auction.winnerId, 'The auction has no winner yet')
        assertExists(auction.highBid, 'The auction has no winning bid')
        assertExists(auction.auctioneerId, 'The auction has no auctioneer')

        this.getPlayerState(auction.winnerId).adjustMoney(-auction.highBid)
        const cut = auction.winnerId === auction.auctioneerId ? 0 : auctioneerCut(auction.highBid)
        this.getPlayerState(auction.auctioneerId).adjustMoney(cut)

        this.getShopState(shopId).ownerId = auction.winnerId
        const pullIns = this.pullInCustomers(shopId)

        this.auction = undefined

        return {
            shopId,
            bids: auction.participants.map((participant) => {
                assertExists(participant.bid, `Player ${participant.playerId} has not bid`)
                return { playerId: participant.playerId, amount: participant.bid }
            }),
            winnerId: auction.winnerId,
            price: auction.highBid,
            auctioneerCut: cut,
            pullIns
        }
    }

    turnPlayerId(): string {
        const turn = this.turnManager.currentTurn()
        assertExists(turn, 'No turn is in progress')
        return turn.playerId
    }

    isNextAntiqueSet(collectorId: string): boolean {
        return this.pendingAntiqueSets[0] === collectorId
    }

    canAct(playerId: string): boolean {
        return this.canMoveVisitors() || this.canStartAuction(playerId)
    }

    emptyEntranceIds(): FountainId[] {
        return EntranceFountainIds.filter(
            (fountainId) => this.getFountainState(fountainId).visitors.length === 0
        )
    }

    needsRefill(): boolean {
        return this.queue.length > 0 && this.emptyEntranceIds().length > 0
    }

    canBringVisitors(count: number, entranceId: FountainId): boolean {
        return (
            this.emptyEntranceIds().includes(entranceId) &&
            isValidVisitorCount(count, this.queue.length)
        )
    }

    bringVisitors(end: QueueEnd, count: number, entranceId: FountainId): MarketColor[] {
        const visitors =
            end === QueueEnd.Front ? this.queue.splice(0, count) : this.queue.splice(-count, count)
        this.getFountainState(entranceId).visitors.push(...visitors)
        if (this.queue.length === 0) {
            this.finalRound = true
        }
        return visitors
    }

    turnEndsGame(): boolean {
        return this.finalRound && this.turnPlayerId() === this.turnManager.turnOrder.at(-1)
    }

    finishTurn(): { gameOver: boolean } {
        const gameOver = this.turnEndsGame()
        const endedTurn = this.turnManager.endTurn(this.actionCount)
        this.turnActions = []
        if (endedTurn.playerId === this.turnManager.turnOrder.at(-1)) {
            this.round += 1
        }
        return { gameOver }
    }

    // The round in which the queue runs out is the last, and it ends with the last seat's turn.
    finalTurnPlayerId(): string | undefined {
        return this.finalRound && this.machineState !== MachineState.EndOfGame
            ? this.turnManager.turnOrder.at(-1)
            : undefined
    }

    // Mirrors the money visibility policy, for views that hold every player's cash.
    isMoneyVisibleTo(
        viewerId: string | undefined,
        ownerId: string,
        config: Partial<MarracashGameConfig> | undefined
    ): boolean {
        return (
            config?.concealedCash !== true ||
            viewerId === ownerId ||
            this.machineState === MachineState.EndOfGame
        )
    }

    completesAntiqueSet(playerId: string, customers: Record<MarketColor, number>): boolean {
        const player = this.getPlayerState(playerId)
        return player.revealedAntiques.length === 0 && coversAntiqueSet(player.antiques, customers)
    }

    leadingPlayerIds(): string[] {
        const mostMoney = Math.max(...this.players.map((player) => player.getMoney()))
        return this.players
            .filter((player) => player.getMoney() === mostMoney)
            .map((player) => player.playerId)
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
        this.getPlayerState(shop.ownerId).adjustMoney(income)
        this.noteAntiqueSetIfComplete(shop.ownerId)
        return income
    }

    private transferMoney(fromId: string, toId: string, amount: number) {
        this.getPlayerState(fromId).adjustMoney(-amount)
        this.getPlayerState(toId).adjustMoney(amount)
    }

    private noteAntiqueSetIfComplete(playerId: string) {
        const player = this.getPlayerState(playerId)
        if (
            !this.antiqueCards ||
            player.revealedAntiques.length > 0 ||
            this.pendingAntiqueSets.includes(playerId)
        ) {
            return
        }
        assert(
            player.antiques.length === AntiquesPerPlayer,
            `Player ${playerId}'s antique hand is not known in this representation`
        )
        if (this.completesAntiqueSet(playerId, this.customersByColor(playerId))) {
            this.pendingAntiqueSets.push(playerId)
        }
    }

    customersByColor(playerId: string): Record<MarketColor, number> {
        const counts = emptyColorCounts()
        for (const shop of this.shops) {
            if (shop.ownerId === playerId) {
                counts[getShop(shop.shopId).color] += shop.customers
            }
        }
        return counts
    }
}
