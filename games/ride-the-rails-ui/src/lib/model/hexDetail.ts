import {
    railroadsIn,
    cityIn,
    type HexId,
    type HydratedRideTheRailsGameState
} from '@tabletop/ride-the-rails'

function hasPassengerIn(state: HydratedRideTheRailsGameState, hexId: HexId): boolean {
    const city = cityIn(hexId)
    return city !== undefined && state.passengers.includes(city.id)
}

// What the hex detail shows that a Game State can change: its locomotives and its passenger.
export function hexChangedBetween(
    before: HydratedRideTheRailsGameState,
    after: HydratedRideTheRailsGameState,
    hexId: HexId
): boolean {
    const railroadsBefore = railroadsIn(before.track, hexId)
    const railroadsAfter = railroadsIn(after.track, hexId)
    return (
        railroadsBefore.length !== railroadsAfter.length ||
        railroadsBefore.some((railroadId, index) => railroadsAfter[index] !== railroadId) ||
        hasPassengerIn(before, hexId) !== hasPassengerIn(after, hexId)
    )
}
