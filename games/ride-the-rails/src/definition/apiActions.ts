import type * as Type from 'typebox'
import { PassJourney } from '../actions/passJourney.js'
import { RideJourney } from '../actions/rideJourney.js'
import { ActionType } from './actions.js'

export const RideTheRailsApiActions: Record<string, Type.TSchema> = {
    [ActionType.RideJourney]: RideJourney,
    [ActionType.PassJourney]: PassJourney
}
