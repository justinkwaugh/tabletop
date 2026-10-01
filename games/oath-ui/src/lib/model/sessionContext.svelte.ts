import { assert } from '@tabletop/common'
import { createGameSessionContext, type GameSession } from '@tabletop/frontend-components'
import type { HydratedOathGameState, OathProjectedState } from '@tabletop/oath'
import { OathGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<OathGameSession>()

export function setGameSession(session: OathGameSession) {
    setContext(session)
}

export function getGameSession(): OathGameSession {
    return getContext()
}

// The platform mounts the table with its base session type; the runtime's `sessionClass` guarantees the instance.
export function toOathSession(
    session: GameSession<OathProjectedState, HydratedOathGameState>
): OathGameSession {
    assert(session instanceof OathGameSession, 'The Oath table needs an OathGameSession')
    return session
}
