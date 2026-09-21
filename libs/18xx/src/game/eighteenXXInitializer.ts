import { Prng } from '@tabletop/common'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import {
    BaseGameInitializer,
    Color,
    HydratedTurnManager,
    assert,
    type Game,
    type PlayerState,
    type UninitializedGameState
} from '@tabletop/common'
import { StockMarket } from '../stock/stockMarket.js'
import { createStockRound } from '../stock/stockRound.js'
import { EighteenXXState, HydratedEighteenXXState } from './eighteenXXState.js'
import type { EighteenXXTitleRules, InitialFinances } from './eighteenXXTitleRules.js'
export type InitialStateParts = {
    stockRoundNumber: number
    stockMarket: StockMarket
    finances: InitialFinances
}
export type EighteenXXInitializerRules = Pick<
    EighteenXXTitleRules,
    | 'createFinances'
    | 'offerAuctionRules'
    | 'auctionRules'
    | 'createMarket'
    | 'map'
    | 'tileSet'
    | 'trainRules'
    | 'privateRules'
    | 'stockRules'
>
export class EighteenXXInitializer extends BaseGameInitializer<
    EighteenXXState,
    HydratedEighteenXXState
> {
    static readonly playerColors = [Color.Blue, Color.Red, Color.Green, Color.Yellow, Color.Purple, Color.Orange]
    constructor(protected readonly rules: EighteenXXInitializerRules) {
        super()
    }
    initializeGameState(game: Game, state: UninitializedGameState): HydratedEighteenXXState {
        assert(
            (this.rules.auctionRules || this.rules.offerAuctionRules) &&
                game.players.length >= 2 &&
                game.players.length <= 6,
            'Unsupported player count or opening'
        )
        const initialized = this.createInitialState(game, state, {
            stockRoundNumber: 1,
            stockMarket: this.rules.createMarket(),
            finances: this.rules.createFinances(this.playerStates(game), new Prng(state.prng))
        })
        if (initialized.offerAuction) {
            const playerId = initialized.offerAuction.auctioneerId
            initialized.turnManager.newFirstPlayer(playerId)
            initialized.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
            initialized.activePlayerIds = [playerId]
            initialized.machineState = 'OfferingLot'
        } else {
            assert(this.rules.auctionRules, 'Opening auction requires its rules')
            const order = initialized.turnManager.turnOrder
            const first = initialized.getPublicPrng().randInt(order.length)
            initialized.turnManager.newFirstPlayer(order[first])
            initialized.turnManager.series = [{ type: 'turn', playerId: order[0], start: 0 }]
            initialized.activePlayerIds = [order[0]]
            initialized.openingAuction = {
                remainingLotIds: this.rules.auctionRules.lots(initialized).map((lot) => lot.id),
                reservations: [],
                nextPlayerId: order[0],
                passedPlayerIds: [],
                discount: 0,
                awards: [],
                completed: false
            }
            initialized.machineState = 'WaterfallAuction'
        }
        this.applyPhaseEffects(initialized)
        return initialized
    }
    protected playerStates(game: Game): PlayerState[] {
        return game.players.map((player, index) => ({
            playerId: player.id,
            color: EighteenXXInitializer.playerColors[index]
        }))
    }
    protected createInitialState(
        game: Game,
        state: UninitializedGameState,
        parts: InitialStateParts
    ): HydratedEighteenXXState {
        const players = this.playerStates(game)
        return new HydratedEighteenXXState(
            {
                ...state,
                players,
                activePlayerIds: [players[0].playerId],
                example: 'finances',
                phaseEvents: [],
                usedPrivatePowerIds: [],
                machineState: 'StockRound',
                stockRound: createStockRound(parts.stockRoundNumber),
                stockMarket: parts.stockMarket,
                turnManager: new HydratedTurnManager({
                    series: [{ type: 'turn', playerId: players[0].playerId, start: 0 }],
                    turnOrder: players.map((player) => player.playerId),
                    turnCounts: Object.fromEntries(players.map((player) => [player.playerId, 0]))
                }),
                ...parts.finances
            },
            this.rules.map,
            this.rules.tileSet,
            this.rules.trainRules.depot
        )
    }
    protected applyPhaseEffects(state: HydratedEighteenXXState): void {
        applyPrivateEffects(state, this.rules.privateRules.phaseEffects(state), this.rules.stockRules)
    }
}
