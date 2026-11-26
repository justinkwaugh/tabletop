import type { LobbyMessage, StoredLobbyPost } from '../model/storedLobbyPost.js'

export interface LobbyPostStore {
    findPost(gameId: string): Promise<StoredLobbyPost | undefined>
    /**
     * Records the game's message in its channel unless the game has one there already; returns
     * the message it has there now.
     */
    claimMessage(gameId: string, message: LobbyMessage): Promise<LobbyMessage>
    /** Forgets the game's message in its channel if it is still this one, keeping the count. */
    clearMessage(gameId: string, message: LobbyMessage): Promise<void>
}
