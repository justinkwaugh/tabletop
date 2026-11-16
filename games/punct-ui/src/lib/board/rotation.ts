// A piece's rotation counts sixths of a turn clockwise.
export const FULL_TURN = 6

// Steps round from 0 up to the period, so a rotation and the same one a turn round compare equal.
export function wrapRotation(steps: number, period = FULL_TURN): number {
    return ((steps % period) + period) % period
}

// The fewest steps from one rotation to another, clockwise positive, a half turn clockwise.
export function shortestTurn(from: number, to: number): number {
    const clockwise = wrapRotation(to - from)
    return clockwise > FULL_TURN / 2 ? clockwise - FULL_TURN : clockwise
}
