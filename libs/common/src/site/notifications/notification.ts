import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export enum NotificationCategory {
    Game = 'game',
    User = 'user',
    System = 'system'
}

export type Notification = Type.Static<typeof Notification>
export const Notification = Type.Object({
    id: Type.String(),
    type: Type.Enum(NotificationCategory),
    action: Type.String(),
    data: Type.Object({})
})

export const NotificationValidator = Compile(Notification)
