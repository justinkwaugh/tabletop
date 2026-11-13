import {
    railroadsIn,
    usaHex,
    type HexId,
    type HydratedRideTheRailsGameState
} from '@tabletop/ride-the-rails'

function hasPassengerIn(state: HydratedRideTheRailsGameState, hexId: HexId): boolean {
    const hex = usaHex(hexId)
    return hex.terrain === 'city' && state.passengers.includes(hex.cityId)
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
