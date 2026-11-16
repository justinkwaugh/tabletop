import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { OstbahnRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { RailroadId } from '../components/railroads.js'
import { HydratedOstbahnGameState, type OstbahnGameState } from '../model/gameState.js'

export const engine = new GameEngine(OstbahnRuntime)
export const masterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, seed = 11): Game {
    return OstbahnRuntime.initializer.initializeGame(
        {
            id: 'ostbahn-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

type ActionFields = Record<string, unknown> & { type: ActionType }

export class Table {
    readonly game: Game
    state: OstbahnGameState
    processed: GameAction[] = []

    constructor(count: number, seed = 11) {
        this.game = createGame(count, seed)
        this.state = engine.startGame(this.game, { masterSeed }).initialState
    }

    get hydrated(): HydratedOstbahnGameState {
        return new HydratedOstbahnGameState(structuredClone(this.state))
    }

    get active(): string {
        const [playerId] = this.state.activePlayerIds
        assertExists(playerId, `Nobody is active in ${this.state.machineState}`)
        return playerId
    }

    act(playerId: string, fields: ActionFields): GameAction[] {
        const action = {
            id: `a${this.state.actionCount}`,
            gameId: this.state.gameId,
            source: ActionSource.User,
            playerId,
            ...fields
        }
        const result = engine.executeCanonicalAction({ game: this.game, state: this.state, action })
        this.state = result.updatedState
        this.processed.push(...result.processedActions)
        return result.processedActions
    }

    edit(change: (state: HydratedOstbahnGameState) => void) {
        const hydrated = this.hydrated
        change(hydrated)
        this.state = hydrated.dehydrate()
    }

    drawTurnOrder(): GameAction[] {
        return this.act(this.active, { type: ActionType.DeterminePlayerOrder, revealsInfo: true })
    }

    playOpening(prices: Partial<Record<RailroadId, [string, number]>> = {}) {
        this.playInitialAuctions(prices)
        this.drawTurnOrder()
    }

    playInitialAuctions(prices: Partial<Record<RailroadId, [string, number]>> = {}) {
        while (this.state.machineState === MachineState.ShareBidding) {
            const auction = this.state.shareAuction
            assertExists(auction, 'An opening auction is under way')
            const [buyer, price] = prices[auction.railroadId] ?? []
            const bidder = this.active
            if (bidder === buyer && !this.hydrated.bidding().hasBid) {
                this.act(bidder, { type: ActionType.PlaceBid, amount: price })
            } else {
                this.act(bidder, { type: ActionType.PassBid })
            }
        }
    }
}
