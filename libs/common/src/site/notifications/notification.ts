import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

export enum NotificationCategory {
    Game = 'game',
    User = 'user',
    System = 'system'
}

export type Notification = Static<typeof Notification>
export const Notification = Type.Object({
    id: Type.String(),
    type: Type.Enum(NotificationCategory),
    action: Type.String(),
    data: Type.Object({})
})

export const NotificationValidator = TypeCompiler.Compile(Notification)
