import type * as Type from 'typebox'
import { Announce } from '../actions/announce.js'
import { Bid } from '../actions/bid.js'
import { CallKing } from '../actions/callKing.js'
import { ChooseContract } from '../actions/chooseContract.js'
import { ChooseTalonHalf } from '../actions/chooseTalonHalf.js'
import { DealHand } from '../actions/dealHand.js'
import { EndHand } from '../actions/endHand.js'
import { GiveUp } from '../actions/giveUp.js'
import { LayAway } from '../actions/layAway.js'
import { Pass } from '../actions/pass.js'
import { PickUpTalon } from '../actions/pickUpTalon.js'
import { PlayCard } from '../actions/playCard.js'
import { RevealTalon } from '../actions/revealTalon.js'
import { SayMeinSpiel } from '../actions/sayMeinSpiel.js'
import { ActionType } from './actions.js'

export const KoenigrufenActionSchemas = {
    [ActionType.DealHand]: DealHand,
    [ActionType.SayMeinSpiel]: SayMeinSpiel,
    [ActionType.Bid]: Bid,
    [ActionType.Pass]: Pass,
    [ActionType.ChooseContract]: ChooseContract,
    [ActionType.CallKing]: CallKing,
    [ActionType.RevealTalon]: RevealTalon,
    [ActionType.ChooseTalonHalf]: ChooseTalonHalf,
    [ActionType.GiveUp]: GiveUp,
    [ActionType.PickUpTalon]: PickUpTalon,
    [ActionType.LayAway]: LayAway,
    [ActionType.Announce]: Announce,
    [ActionType.PlayCard]: PlayCard,
    [ActionType.EndHand]: EndHand
} satisfies Record<ActionType, Type.TSchema>
