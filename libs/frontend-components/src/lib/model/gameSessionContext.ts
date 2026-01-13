import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { createContext } from 'svelte'

const [getGameSessionContext, setGameSessionContext] = createContext<GameSession<any, any>>()

export const setGameSession = setGameSessionContext
export const getGameSession = getGameSessionContext

// This can be used to make typesafe game session context setters and getters
export function createGameSessionContext<TSession extends GameSession<any, any>>(): [
    getGameSession: () => TSession,
    setGameSession: (session: TSession) => void
] {
    const [getGameContext, setGameContext] = createContext<TSession>()

    function setGameSession(session: TSession) {
        setGameSessionContext(session)
        setGameContext(session)
    }

    function getGameSession(): TSession {
        return getGameContext()
    }

    return [getGameSession, setGameSession]
}
