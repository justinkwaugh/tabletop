import type { Point } from '@tabletop/common'
import type { CityId } from '@tabletop/ride-the-rails'
import { stationOf } from './boardGeometry.js'

// The passenger figure is laid out beside a station disc of this radius and scaled to each city's.
const DRAWN_RADIUS = 10.6
const OFFSET = { x: 17.2, y: -8.8 }
/** A picked journey start lifts its passenger slightly, in the figure's own units. */
export const PASSENGER_LIFT = 6

export type PassengerSpot = Point & { scale: number }

/** Where a city's waiting passenger stands, in board units, and the figure's scale there. */
export function passengerSpot(cityId: CityId, lifted: boolean): PassengerSpot {
    const station = stationOf(cityId)
    const scale = station.radius / DRAWN_RADIUS
    return {
        x: station.x + OFFSET.x * scale,
        y: station.y + (OFFSET.y - (lifted ? PASSENGER_LIFT : 0)) * scale,
        scale
    }
}
