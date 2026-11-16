import type { RailroadId } from '@tabletop/ride-the-rails'
import type { RideTheRailsGameSession } from './session.svelte.js'

type KeyPress = Pick<KeyboardEvent, 'key' | 'preventDefault'>
type PointerMove = Pick<PointerEvent, 'pointerType'>

export type SpotlightHandlers = {
    onclick: () => void
    onkeydown: (event: KeyPress) => void
    onpointerenter: (event: PointerMove) => void
    onpointerleave: (event: PointerMove) => void
}

// Contract, Look: railroad spotlight: a pointer hovers it, touch and keyboard press it.
export function spotlightHandlers(
    session: RideTheRailsGameSession,
    railroadId: RailroadId
): SpotlightHandlers {
    return {
        onclick: () => session.pressRailroad(railroadId),
        onkeydown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                session.pressRailroad(railroadId)
            }
        },
        onpointerenter: (event) => {
            if (event.pointerType === 'mouse') session.hoverRailroad(railroadId)
        },
        onpointerleave: (event) => {
            if (event.pointerType === 'mouse') session.leaveRailroad()
        }
    }
}
