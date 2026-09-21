import type { GameConfig, PlayerState, Prng } from '@tabletop/common'
import { assert } from '@tabletop/common'
import type { OfferPileAuction } from '../auctions/offerPileAuction.js'
import type { WaterfallAuctionRules } from '../auctions/waterfallAuction.js'
import type { CompanyState } from '../company/companyState.js'
import type { MapStateData } from '../map/mapState.js'
import type { StockMarket } from '../stock/stockMarket.js'
import type { TrainState } from '../trains/train.js'
import type { HydratedEighteenXXState } from './eighteenXXState.js'

export type OpeningSetup = {
    players: readonly PlayerState[]
    prng: Prng
    config: GameConfig
}
export type InitialPosition = CompanyState &
    MapStateData &
    TrainState & { stockMarket: StockMarket }
export type Opening = {
    position: InitialPosition
    titleState?: Readonly<Record<string, unknown>>
    begin(state: HydratedEighteenXXState): void
}

function beginWith(state: HydratedEighteenXXState, machineState: string, playerId: string): void {
    state.turnManager.newFirstPlayer(playerId)
    state.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
    state.activePlayerIds = [playerId]
    state.machineState = machineState
}

export function beginWaterfallAuction(rules: WaterfallAuctionRules): Opening['begin'] {
    return (state) => {
        const order = state.turnManager.turnOrder
        const firstPlayerId = order[state.getPublicPrng().randInt(order.length)]
        state.openingAuction = {
            remainingLotIds: rules.lots(state).map((lot) => lot.id),
            reservations: [],
            nextPlayerId: firstPlayerId,
            passedPlayerIds: [],
            discount: 0,
            awards: [],
            completed: false
        }
        beginWith(state, 'WaterfallAuction', firstPlayerId)
    }
}

export function beginOfferPileAuction(auction: OfferPileAuction): Opening['begin'] {
    return (state) => {
        assert(
            state.players.some((player) => player.playerId === auction.auctioneerId),
            'The first auctioneer must be a player'
        )
        state.offerAuction = auction
        beginWith(state, 'OfferingLot', auction.auctioneerId)
    }
}
