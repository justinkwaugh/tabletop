import { createGameSessionContext } from '@tabletop/frontend-components'
import { MedinaGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<MedinaGameSession>()

export function setGameSession(session: MedinaGameSession) {
    setContext(session)
}

export function getGameSession(): MedinaGameSession {
    return getContext()
}
