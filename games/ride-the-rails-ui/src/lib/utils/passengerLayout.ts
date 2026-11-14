import type { Point } from '@tabletop/common'
import type { CityId } from '@tabletop/ride-the-rails'
import { stationOf } from './boardGeometry.js'
import { cityMarkScale, passengerOffset } from './cityMarks.js'

/** A picked journey start lifts its passenger slightly, in the figure's own units. */
const PASSENGER_LIFT = 8

export type PassengerSpot = Point & { scale: number }

/** Where a city's passenger stands, or stood, in board units, and the figure's scale there. */
export function passengerSpot(cityId: CityId, lifted: boolean): PassengerSpot {
    const station = stationOf(cityId)
    const scale = cityMarkScale(cityId)
    const offset = passengerOffset(cityId)
    return {
        x: station.x + offset.x * scale,
        y: station.y + (offset.y - (lifted ? PASSENGER_LIFT : 0)) * scale,
        scale
    }
}
