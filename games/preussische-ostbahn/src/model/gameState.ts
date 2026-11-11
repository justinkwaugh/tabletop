import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedRoundManager,
    HydratedTurnManager,
    PassableBidding,
    PrngState,
    RoundManager,
    SimpleAuction,
    assertExists,
    type RandomState
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { RAILROAD_IDS, RailroadId } from '../components/railroads.js'
import {
    FRESH_EXPANSION,
    buildChoices,
    canExpand,
    trackCharge,
    type ExpansionTally
} from './expansion.js'
import { findRailroad, playerIncome, railroadIncome, sharesHeld, unsoldShares } from './network.js'
import { HydratedOstbahnPlayerState, OstbahnPlayerState } from './playerState.js'
import { RailroadState } from './railroadState.js'
import { fillCup, type CupEntry } from './turnOrder.js'

export enum ShareAuctionKind {
    Initial = 'Initial',
    Capitalization = 'Capitalization'
}

export type ShareAuction = Type.Static<typeof ShareAuction>
export const ShareAuction = Type.Object({
    kind: Type.Enum(ShareAuctionKind),
    railroadId: Type.Enum(RailroadId),
    bidding: SimpleAuction
})

export type ExpansionInProgress = Type.Static<typeof ExpansionInProgress>
export const ExpansionInProgress = Type.Object({
    railroadId: Type.Enum(RailroadId),
    built: Type.Array(Type.String()),
    spent: Type.Number(),
    freeRuralCost: Type.Number(),
    connectedBefore: Type.Array(Type.Enum(RailroadId))
})

export type OstbahnGameState = Type.Static<typeof OstbahnGameState>
export const OstbahnGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(OstbahnPlayerState),
            machineState: Type.Enum(MachineState),
            rounds: RoundManager,
            railroads: Type.Array(RailroadState),
            shareAuction: Type.Optional(ShareAuction),
            expansion: Type.Optional(ExpansionInProgress),
            dividendRailroadId: Type.Optional(Type.Enum(RailroadId))
        })
    ])
)

export const OstbahnGameStateValidator = Compile(OstbahnGameState)

export class HydratedOstbahnGameState
    extends HydratableGameState<typeof OstbahnGameState, HydratedOstbahnPlayerState>
    implements OstbahnGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedOstbahnPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare rounds: HydratedRoundManager
    declare railroads: RailroadState[]
    declare shareAuction?: ShareAuction
    declare expansion?: ExpansionInProgress
    declare dividendRailroadId?: RailroadId

    constructor(data: OstbahnGameState) {
        super(data, OstbahnGameStateValidator)
        this.players = data.players.map((player) => new HydratedOstbahnPlayerState(player))
        this.rounds = new HydratedRoundManager(data.rounds)
    }

    get seatOrder(): string[] {
        return this.players.map((player) => player.playerId)
    }

    // The turn manager's order is the round's draw from the cup, so a player may hold several
    // slots; it is only ever walked by slot, never with nextPlayer.
    get turnSlots(): string[] {
        return this.turnManager.turnOrder
    }

    get slotIndex(): number {
        const roundStart = this.rounds.currentRound?.start
        if (roundStart === undefined) {
            return 0
        }
        return this.turnManager.series.filter(
            (turn) => turn.start >= roundStart && turn.end !== undefined
        ).length
    }

    railroad(id: RailroadId): RailroadState {
        return findRailroad(this.railroads, id)
    }

    income(id: RailroadId): number {
        return railroadIncome(this.railroad(id))
    }

    playerIncome(playerId: string): number {
        return playerIncome(this.railroads, playerId)
    }

    sharesHeld(id: RailroadId, playerId: string): number {
        return sharesHeld(this.railroad(id), playerId)
    }

    nextInitialRailroad(): RailroadId | undefined {
        return RAILROAD_IDS.find((id) => this.railroad(id).owners.length === 0)
    }

    bidding(): PassableBidding {
        const auction = this.shareAuction
        assertExists(auction, 'No share auction in progress')
        return new PassableBidding(auction.bidding)
    }

    smallestBid(): number {
        const bidding = this.bidding()
        return bidding.hasBid ? bidding.highBid + 1 : 1
    }

    slotPlayerId(): string {
        const playerId = this.turnSlots[this.slotIndex]
        assertExists(playerId, `No player for turn slot ${this.slotIndex}`)
        return playerId
    }

    isSlotPlayer(playerId: string): boolean {
        return (
            this.machineState === MachineState.ChoosingAction &&
            this.turnSlots[this.slotIndex] === playerId
        )
    }

    capitalizableRailroads(): RailroadId[] {
        const leastSold = Math.min(...this.railroads.map((railroad) => railroad.owners.length))
        return RAILROAD_IDS.filter((id) => {
            const railroad = this.railroad(id)
            return unsoldShares(railroad) > 0 && railroad.owners.length <= leastSold
        })
    }

    expandableRailroads(playerId: string): RailroadId[] {
        return RAILROAD_IDS.filter(
            (id) => this.sharesHeld(id, playerId) > 0 && canExpand(this.railroads, id)
        )
    }

    expansionTally(id: RailroadId): ExpansionTally {
        const expansion = this.expansion
        if (!expansion || expansion.railroadId !== id) {
            return FRESH_EXPANSION
        }
        return {
            built: expansion.built.length,
            spent: expansion.spent,
            freeRuralCost: expansion.freeRuralCost
        }
    }

    buildChoices(id: RailroadId): string[] {
        return buildChoices(this.railroads, id, this.expansionTally(id))
    }

    trackCharge(id: RailroadId, spaceId: string): number {
        return trackCharge(this.railroads, id, spaceId, this.expansionTally(id))
    }

    isExpanding(playerId: string): boolean {
        return (
            this.machineState === MachineState.Expanding &&
            this.turnSlots[this.slotIndex] === playerId
        )
    }

    incomeCup(): CupEntry[] {
        return fillCup(
            this.seatOrder.map((playerId) => ({ playerId, income: this.playerIncome(playerId) }))
        )
    }

    richestPlayerIds(): string[] {
        const most = Math.max(...this.players.map((player) => player.cash))
        return this.players
            .filter((player) => player.cash === most)
            .map((player) => player.playerId)
    }
}
