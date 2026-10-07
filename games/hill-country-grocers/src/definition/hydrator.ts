import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedHcgGameState, type HcgGameState } from '../model/gameState.js'
import { HydratedBuildNetwork, isBuildNetwork } from '../actions/buildNetwork.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import { HydratedOpenAuction, isOpenAuction } from '../actions/openAuction.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPayDividends, isPayDividends } from '../actions/payDividends.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedSkipBonusCube, isSkipBonusCube } from '../actions/skipBonusCube.js'
import {
    HydratedTakeDevelopmentCash,
    isTakeDevelopmentCash
} from '../actions/takeDevelopmentCash.js'

export class HcgHydrator implements GameHydrator<HcgGameState, HydratedHcgGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isChooseAction(data):
                return new HydratedChooseAction(data)
            case isBuildNetwork(data):
                return new HydratedBuildNetwork(data)
            case isSkipBonusCube(data):
                return new HydratedSkipBonusCube(data)
            case isDevelop(data):
                return new HydratedDevelop(data)
            case isTakeDevelopmentCash(data):
                return new HydratedTakeDevelopmentCash(data)
            case isOpenAuction(data):
                return new HydratedOpenAuction(data)
            case isPayDividends(data):
                return new HydratedPayDividends(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: HcgGameState): HydratedHcgGameState {
        return new HydratedHcgGameState(state)
    }
}
