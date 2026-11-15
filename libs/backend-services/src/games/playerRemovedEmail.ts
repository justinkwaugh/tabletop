import { Type, type Static } from 'typebox'
import { isOffensiveUsername } from '../moderation/offensiveLanguage.js'

export const PlayerRemovedEmailTask = Type.Object(
    {
        removedUserId: Type.String(),
        gameId: Type.String(),
        toEmail: Type.String()
    },
    { additionalProperties: false }
)
export type PlayerRemovedEmailTask = Static<typeof PlayerRemovedEmailTask>

// A Ban often follows an offensive Username, which must not be sent out to the other Players.
export function removedPlayerDisplayName(seatName: string): string {
    return isOffensiveUsername(seatName) ? 'A player' : seatName
}
