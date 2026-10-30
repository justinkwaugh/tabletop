import type { GameAction } from '@tabletop/common'
import { TownEventKind, isPlaceTrack } from '@tabletop/promontory-point'

// The beats of an action on its action timeline, in seconds, so every animator that answers one
// action places its tweens against the same explicit positions.

// R-3.3: the placed piece rests on its hex this long into a PlaceTrack; the piece's flight ends
// here. Reduced motion shows it there at once.
export const PIECE_FLIGHT_SECONDS = 0.45

// R-4.2: a Dividend or Repairs tile swells as the piece settles on it, then eases back.
export const TOWN_PULSE = { swellSeconds: 0.16, easeBackSeconds: 0.24, scale: 1.16 }

export function pieceSettlesAt(reducedMotion: boolean): number {
    return reducedMotion ? 0 : PIECE_FLIGHT_SECONDS
}

// R-4.2: a price town moves its marker once the piece settles; a Dividend pays as its tile swells.
// Trades and Repairs payments move money from the start.
export function townEffectStartsAt(action: GameAction, reducedMotion: boolean): number {
    if (!isPlaceTrack(action)) return 0
    const settled = pieceSettlesAt(reducedMotion)
    const kind = action.metadata?.outcome?.kind
    return kind === TownEventKind.Dividend || kind === TownEventKind.Repairs
        ? settled + (reducedMotion ? 0 : TOWN_PULSE.swellSeconds)
        : settled
}
