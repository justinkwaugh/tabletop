import { Type, type Static } from 'typebox'
import { m, type Locale } from '@tabletop/email/i18n'
import { isOffensiveUsername } from '../moderation/offensiveLanguage.js'

export const PlayerRemovedEmailTask = Type.Object(
    {
        removedUserId: Type.String(),
        gameId: Type.String(),
        toEmail: Type.String(),
        recipientId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type PlayerRemovedEmailTask = Static<typeof PlayerRemovedEmailTask>

// A Ban often follows an offensive Username, which must not be sent out to the other Players.
export function removedPlayerDisplayName(seatName: string, locale: Locale): string {
    return isOffensiveUsername(seatName)
        ? m.email_player_removed_unnamed_player({}, { locale })
        : seatName
}
