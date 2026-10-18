export const GLOBAL_TOPIC = 'global'

export const RELAY_STATS_TOPIC = 'relay-stats'

export function userTopic(userId: string): string {
    return `user-${userId}`
}

export function gameTopic(gameId: string): string {
    return `game-${gameId}`
}
