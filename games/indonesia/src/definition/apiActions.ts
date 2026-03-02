import { ActionType } from './actions.js'

import { StartCompany } from '../actions/startCompany.js'
import { ProposeMerger } from '../actions/proposeMerger.js'
import { PlaceMergerBid } from '../actions/placeMergerBid.js'
import { PassMergerBid } from '../actions/passMergerBid.js'
import { RemoveSiapSajiArea } from '../actions/removeSiapSajiArea.js'
import { SetTurnOrder } from '../actions/setTurnOrder.js'
import { PlaceTurnOrderBid } from '../actions/placeTurnOrderBid.js'
import { PlaceCompanyDeeds } from '../actions/placeCompanyDeeds.js'
import { PlaceCity } from '../actions/placeCity.js'
import { Pass } from '../actions/pass.js'
import { RemoveCompanyDeed } from '../actions/removeCompanyDeed.js'
import { Research } from '../actions/research.js'
import { DeliverGood } from '../actions/deliverGood.js'
import { Expand } from '../actions/expand.js'
import { GrowCity } from '../actions/growCity.js'
import { ChooseOperatingCompany } from '../actions/chooseOperatingCompany.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const IndonesiaApiActions = {
    [ActionType.RemoveCompanyDeed]: RemoveCompanyDeed,
    [ActionType.Research]: Research,
    [ActionType.DeliverGood]: DeliverGood,
    [ActionType.Expand]: Expand,
    [ActionType.GrowCity]: GrowCity,
    [ActionType.ChooseOperatingCompany]: ChooseOperatingCompany,
    [ActionType.StartCompany]: StartCompany,
    [ActionType.ProposeMerger]: ProposeMerger,
    [ActionType.PlaceMergerBid]: PlaceMergerBid,
    [ActionType.PassMergerBid]: PassMergerBid,
    [ActionType.RemoveSiapSajiArea]: RemoveSiapSajiArea,
    [ActionType.SetTurnOrder]: SetTurnOrder,
    [ActionType.PlaceTurnOrderBid]: PlaceTurnOrderBid,
    [ActionType.PlaceCompanyDeeds]: PlaceCompanyDeeds,
    [ActionType.PlaceCity]: PlaceCity,
    [ActionType.Pass]: Pass
}
