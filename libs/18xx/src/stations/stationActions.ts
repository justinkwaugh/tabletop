import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StationRules } from './stationPlacement.js'
import { PlaceStation, HydratedPlaceStation, isPlaceStation } from './placeStation.js'
import { FinishStations, HydratedFinishStations, isFinishStations } from './finishStations.js'
import {
    PlaceHomeStations,
    HydratedPlaceHomeStations,
    isPlaceHomeStations
} from './placeHomeStations.js'

export function stationActions(rules: StationRules): ActionDefinition[] {
    return [
        defineAction(
            PlaceStation,
            isPlaceStation,
            (action) => new HydratedPlaceStation(action, rules)
        ),
        defineAction(
            FinishStations,
            isFinishStations,
            (action) => new HydratedFinishStations(action)
        ),
        defineAction(
            PlaceHomeStations,
            isPlaceHomeStations,
            (action) => new HydratedPlaceHomeStations(action, rules)
        )
    ]
}
