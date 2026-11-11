import { ActionType } from './actions.js'
import { ChooseAction } from '../actions/chooseAction.js'
import { Consolidate } from '../actions/consolidate.js'
import { InvestInIndustry } from '../actions/investInIndustry.js'
import { IssueShare } from '../actions/issueShare.js'
import { LayTrack } from '../actions/layTrack.js'
import { PassBid } from '../actions/passBid.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PlaceSealedBid } from '../actions/placeSealedBid.js'

export const RailheadsApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.ChooseAction]: ChooseAction,
    [ActionType.Consolidate]: Consolidate,
    [ActionType.IssueShare]: IssueShare,
    [ActionType.InvestInIndustry]: InvestInIndustry,
    [ActionType.PlaceSealedBid]: PlaceSealedBid,
    [ActionType.LayTrack]: LayTrack
}
