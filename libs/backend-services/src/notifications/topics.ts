export const GLOBAL_TOPIC = 'global'

export const RELAY_STATS_TOPIC = 'relay-stats'

const USER_TOPIC_PREFIX = 'user-'

export function userTopic(userId: string): string {
    return `${USER_TOPIC_PREFIX}${userId}`
}

export function topicUserId(topic: string): string | undefined {
    return topic.startsWith(USER_TOPIC_PREFIX) ? topic.slice(USER_TOPIC_PREFIX.length) : undefined
}

export function gameTopic(gameId: string): string {
    return `game-${gameId}`
}
