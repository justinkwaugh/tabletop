import { createContext } from 'svelte'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte.js'

const [getContext, setContext] = createContext<FreshFishGameSession>()

export function setGameSession(session: FreshFishGameSession) {
    setContext(session)
}

export function getGameSession(): FreshFishGameSession {
    return getContext()
}
