import { BuyMachine } from '../actions/buyMachine.js'
import { BuyWarehouse } from '../actions/buyWarehouse.js'
import { BuyContainersForHarbor } from '../actions/buyContainersForHarbor.js'
import { ProduceContainers } from '../actions/produceContainers.js'
import { SailShip } from '../actions/sailShip.js'
import { SubmitBid } from '../actions/submitBid.js'
import { ResolveAuction } from '../actions/resolveAuction.js'
import { TakeLoan } from '../actions/takeLoan.js'
import { RepayLoan } from '../actions/repayLoan.js'
import { CallBroker } from '../actions/callBroker.js'
import { SelectSeizedContainer } from '../actions/selectSeizedContainer.js'
import { Pass } from '../actions/pass.js'
import { ActionType } from './actions.js'

export const ContainerApiActions = {
    [ActionType.BuyMachine]: BuyMachine,
    [ActionType.BuyWarehouse]: BuyWarehouse,
    [ActionType.BuyContainersForHarbor]: BuyContainersForHarbor,
    [ActionType.ProduceContainers]: ProduceContainers,
    [ActionType.SailShip]: SailShip,
    [ActionType.SubmitBid]: SubmitBid,
    [ActionType.ResolveAuction]: ResolveAuction,
    [ActionType.TakeLoan]: TakeLoan,
    [ActionType.RepayLoan]: RepayLoan,
    [ActionType.CallBroker]: CallBroker,
    [ActionType.SelectSeizedContainer]: SelectSeizedContainer,
    [ActionType.Pass]: Pass
}
