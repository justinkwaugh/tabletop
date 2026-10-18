export const GLOBAL_TOPIC = 'global'

export function userTopic(userId: string): string {
    return `user-${userId}`
}

export function gameTopic(gameId: string): string {
    return `game-${gameId}`
}
