import { Type, type Static } from '@sinclair/typebox'

export enum NotificationType {
    Game = 'game',
    User = 'user'
}

export type Notification = Static<typeof Notification>
export const Notification = Type.Object({
    id: Type.String(),
    type: Type.Enum(NotificationType),
    action: Type.String(),
    data: Type.Object({})
})
