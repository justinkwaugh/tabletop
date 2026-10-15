import {
    ActionSource,
    GameEngine,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailheadsRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { CompanyId } from '../editions/types.js'
import { HydratedRailheadsGameState, type RailheadsProjectedState } from '../model/gameState.js'
import { createGame } from './bot.js'

const engine = new GameEngine(RailheadsRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

type ActionFields = Record<string, unknown> & { type: ActionType }

export class Table {
    readonly game: Game
    state: RailheadsProjectedState
    processed: GameAction[] = []

    constructor(count: number, config: Record<string, boolean | string> = {}) {
        this.game = { ...createGame(count, config), protectedInformation: true }
        this.state = engine.startGame(this.game, {
            masterSeed,
            startingPositions: {
                playerIds: Array.from({ length: count }, (_, index) => `p${index}`)
            }
        }).initialState
    }

    get hydrated(): HydratedRailheadsGameState {
        return new HydratedRailheadsGameState(structuredClone(this.state))
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

    edit(change: (state: HydratedRailheadsGameState) => void) {
        const hydrated = this.hydrated
        change(hydrated)
        this.state = hydrated.dehydrate()
    }

    playInitialAuction(buyers: Partial<Record<CompanyId, string>> = {}) {
        while (this.state.machineState === MachineState.ShareBidding) {
            const auction = this.hydrated.shareAuction
            assertExists(auction, 'An opening auction is under way')
            const buyer = buyers[auction.companyId]
            const bidder = this.active
            if (bidder === buyer && !this.hydrated.bidding().hasBid) {
                this.act(bidder, { type: ActionType.PlaceBid, amount: auction.minimum })
            } else {
                this.act(bidder, { type: ActionType.PassBid })
            }
        }
    }
}
