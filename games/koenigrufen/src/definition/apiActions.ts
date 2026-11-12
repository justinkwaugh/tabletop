import { Announce } from '../actions/announce.js'
import { Bid } from '../actions/bid.js'
import { CallKing } from '../actions/callKing.js'
import { ChooseContract } from '../actions/chooseContract.js'
import { ChooseTalonHalf } from '../actions/chooseTalonHalf.js'
import { GiveUp } from '../actions/giveUp.js'
import { LayAway } from '../actions/layAway.js'
import { Pass } from '../actions/pass.js'
import { PlayCard } from '../actions/playCard.js'
import { SayMeinSpiel } from '../actions/sayMeinSpiel.js'
import { ActionType } from './actions.js'

export const KoenigrufenApiActions = {
    [ActionType.SayMeinSpiel]: SayMeinSpiel,
    [ActionType.Bid]: Bid,
    [ActionType.Pass]: Pass,
    [ActionType.ChooseContract]: ChooseContract,
    [ActionType.CallKing]: CallKing,
    [ActionType.ChooseTalonHalf]: ChooseTalonHalf,
    [ActionType.GiveUp]: GiveUp,
    [ActionType.LayAway]: LayAway,
    [ActionType.Announce]: Announce,
    [ActionType.PlayCard]: PlayCard
}
