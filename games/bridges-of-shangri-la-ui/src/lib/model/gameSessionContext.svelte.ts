import { createContext } from 'svelte'
import { BridgesGameSession } from './BridgesGameSession.svelte.js'

const [getContext, setContext] = createContext<BridgesGameSession>()

export function setGameSession(session: BridgesGameSession) {
    setContext(session)
}

export function getGameSession(): BridgesGameSession {
    return getContext()
}
