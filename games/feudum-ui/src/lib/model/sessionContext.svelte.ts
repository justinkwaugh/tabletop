import { createGameSessionContext } from '@tabletop/frontend-components'
import { FeudumGameSession } from './session.svelte.js'

/** Contract, Shared visual state: a component calls the session's methods; only the session builds and sends an Action. */
export type ComponentSession = Omit<
    FeudumGameSession,
    'applyAction' | 'applyPreparedAction' | 'createPlayerAction'
>

const [getContext, setContext] = createGameSessionContext<FeudumGameSession>()

export function setGameSession(session: FeudumGameSession) {
    setContext(session)
}

export function getGameSession(): ComponentSession {
    return getContext()
}
