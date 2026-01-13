import { createContext } from 'svelte'
import { EstatesGameSession } from './EstatesGameSession.svelte.js'

const [getContext, setContext] = createContext<EstatesGameSession>()

export function setGameSession(session: EstatesGameSession) {
    setContext(session)
}

export function getGameSession(): EstatesGameSession {
    return getContext()
}
