import { ActionType } from './actions.js'
import { BuildNetwork } from '../actions/buildNetwork.js'
import { ChooseAction } from '../actions/chooseAction.js'
import { Develop } from '../actions/develop.js'
import { OpenAuction } from '../actions/openAuction.js'
import { PassBid } from '../actions/passBid.js'
import { PayDividends } from '../actions/payDividends.js'
import { PlaceBid } from '../actions/placeBid.js'
import { SkipBonusCube } from '../actions/skipBonusCube.js'
import { TakeDevelopmentCash } from '../actions/takeDevelopmentCash.js'

export const HcgApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.ChooseAction]: ChooseAction,
    [ActionType.BuildNetwork]: BuildNetwork,
    [ActionType.SkipBonusCube]: SkipBonusCube,
    [ActionType.Develop]: Develop,
    [ActionType.TakeDevelopmentCash]: TakeDevelopmentCash,
    [ActionType.OpenAuction]: OpenAuction,
    [ActionType.PayDividends]: PayDividends
}
