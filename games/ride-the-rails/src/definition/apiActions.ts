import type * as Type from 'typebox'
import { EndBuilding } from '../actions/endBuilding.js'
import { PassJourney } from '../actions/passJourney.js'
import { PlaceLocomotive } from '../actions/placeLocomotive.js'
import { RideJourney } from '../actions/rideJourney.js'
import { TakeShare } from '../actions/takeShare.js'
import { ActionType } from './actions.js'

export const RideTheRailsApiActions: Record<string, Type.TSchema> = {
    [ActionType.RideJourney]: RideJourney,
    [ActionType.PassJourney]: PassJourney,
    [ActionType.TakeShare]: TakeShare,
    [ActionType.PlaceLocomotive]: PlaceLocomotive,
    [ActionType.EndBuilding]: EndBuilding
}
