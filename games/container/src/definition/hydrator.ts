import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedContainerGameState, type ContainerGameState } from '../model/gameState.js'
import { HydratedBuyMachine, isBuyMachine } from '../actions/buyMachine.js'
import { HydratedBuyWarehouse, isBuyWarehouse } from '../actions/buyWarehouse.js'
import {
    HydratedBuyContainersForHarbor,
    isBuyContainersForHarbor
} from '../actions/buyContainersForHarbor.js'
import { HydratedProduceContainers, isProduceContainers } from '../actions/produceContainers.js'
import { HydratedSailShip, isSailShip } from '../actions/sailShip.js'
import { HydratedSubmitBid, isSubmitBid } from '../actions/submitBid.js'
import { HydratedResolveAuction, isResolveAuction } from '../actions/resolveAuction.js'
import { HydratedTakeLoan, isTakeLoan } from '../actions/takeLoan.js'
import { HydratedRepayLoan, isRepayLoan } from '../actions/repayLoan.js'
import { HydratedCallBroker, isCallBroker } from '../actions/callBroker.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import {
    HydratedSelectSeizedContainer,
    isSelectSeizedContainer
} from '../actions/selectSeizedContainer.js'

export class ContainerHydrator
    implements GameHydrator<ContainerGameState, HydratedContainerGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isBuyMachine(data):
                return new HydratedBuyMachine(data)
            case isBuyWarehouse(data):
                return new HydratedBuyWarehouse(data)
            case isBuyContainersForHarbor(data):
                return new HydratedBuyContainersForHarbor(data)
            case isProduceContainers(data):
                return new HydratedProduceContainers(data)
            case isSailShip(data):
                return new HydratedSailShip(data)
            case isSubmitBid(data):
                return new HydratedSubmitBid(data)
            case isResolveAuction(data):
                return new HydratedResolveAuction(data)
            case isTakeLoan(data):
                return new HydratedTakeLoan(data)
            case isRepayLoan(data):
                return new HydratedRepayLoan(data)
            case isCallBroker(data):
                return new HydratedCallBroker(data)
            case isSelectSeizedContainer(data):
                return new HydratedSelectSeizedContainer(data)
            case isPass(data):
                return new HydratedPass(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: ContainerGameState): HydratedContainerGameState {
        return new HydratedContainerGameState(state)
    }
}
