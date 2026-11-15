import { GLOBAL_TOPIC, RELAY_STATS_TOPIC, gameTopic, userTopic } from '@tabletop/backend-services'
import { Role, type User } from '@tabletop/common'
import { Type, type Static } from 'typebox'

export const RealtimeGameTopicsQuery = Type.Object({
    game: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { maxItems: 4 }))
})
export type RealtimeGameTopicsQuery = Static<typeof RealtimeGameTopicsQuery>

export function realtimeTopicsFor({
    user,
    gameIds = [],
    relayStats = false
}: {
    user: Pick<User, 'id' | 'roles'>
    gameIds?: string[]
    relayStats?: boolean
}): string[] {
    const grantsRelayStats = relayStats && user.roles.includes(Role.Admin)
    return [
        userTopic(user.id),
        GLOBAL_TOPIC,
        ...[...new Set(gameIds)].map(gameTopic),
        ...(grantsRelayStats ? [RELAY_STATS_TOPIC] : [])
    ]
}
