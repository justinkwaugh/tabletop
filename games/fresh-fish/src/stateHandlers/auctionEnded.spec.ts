import {
    ActionSource,
    AuctionType,
    HydratedSimultaneousAuction,
    MachineContext,
    TieResolutionStrategy
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { HydratedPlaceStall } from '../actions/placeStall.js'
import { ActionType } from '../definition/actions.js'
import { GoodsType } from '../definition/goodsType.js'
import { MachineState } from '../definition/states.js'
import { generateTestState } from '../util/testHelper.js'
import { AuctionEndedStateHandler } from './auctionEnded.js'

describe('AuctionEndedStateHandler', () => {
    it('leaves no auction behind for the final stalls once the last won stall is placed', () => {
        const state = generateTestState({ numPlayers: 2 })
        state.machineState = MachineState.AuctionEnded
        state.tileBag.remaining = 0
        state.turnManager.startTurn('p1')
        state.currentAuction = new HydratedSimultaneousAuction({
            id: 'last-auction',
            type: AuctionType.Simultaneous,
            participants: [
                { playerId: 'p1', bid: 3, passed: false, submitted: true },
                { playerId: 'p2', bid: 1, passed: false, submitted: true }
            ],
            auctioneerId: 'p1',
            winnerId: 'p1',
            highBid: 3,
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        })
        const placeStall = new HydratedPlaceStall({
            id: 'place-won-stall',
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceStall,
            playerId: 'p1',
            goodsType: GoodsType.Cheese,
            coords: [0, 0]
        })

        const next = new AuctionEndedStateHandler().onAction(
            placeStall,
            new MachineContext({ gameState: state, gameConfig: {} })
        )

        expect(next).toBe(MachineState.TileBagEmptied)
        expect(state.currentAuction).toBeUndefined()
    })
})
