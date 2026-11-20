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

export type ShareButtonHandlers = {
    onclick: () => void
    onpointerenter: (event: PointerMove) => void
    onpointerleave: (event: PointerMove) => void
    /** Ends the hover this button began, if it still holds one. */
    release: () => void
}

// Contract, Take a share: a mouse over an enabled share button spotlights its railroad, as a
// railroad card does off turn; a press only takes the share, and touch never spotlights. Under a
// resting mouse the button can be disabled or leave the page (the share taken, the turn passed)
// with no pointer leave to follow, so the button then releases its hover itself.
export function shareButtonHandlers(
    session: Pick<RideTheRailsGameSession, 'takeShare' | 'hoverRailroad' | 'leaveRailroad'>,
    railroadId: RailroadId,
    enabled: boolean
): ShareButtonHandlers {
    let hovering = false
    const release = () => {
        if (hovering) {
            hovering = false
            session.leaveRailroad()
        }
    }
    return {
        onclick: () => session.takeShare(railroadId),
        onpointerenter: (event) => {
            if (enabled && event.pointerType === 'mouse') {
                hovering = true
                session.hoverRailroad(railroadId)
            }
        },
        onpointerleave: release,
        release
    }
}
