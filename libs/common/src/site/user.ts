import * as Type from 'typebox'
import { DateType } from '../util/typebox.js'
import { Color } from '../game/model/colors.js'

export enum Role {
    User = 'user',
    Developer = 'developer',
    Admin = 'admin',
    BetaTester = 'betatester',
    AlphaTester = 'alphatester'
}

export enum UserStatus {
    Active = 'active',
    Inactive = 'inactive',
    Deleted = 'deleted',
    Incomplete = 'incomplete'
}

export enum ExternalAuthService {
    Google = 'google',
    Apple = 'apple',
    Discord = 'discord'
}

export const REMINDER_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type ReminderDay = (typeof REMINDER_DAYS)[number]

const ReminderDayHours = Type.Array(Type.Integer({ minimum: 0, maximum: 23 }), {
    uniqueItems: true
})

export type ReminderHours = Type.Static<typeof ReminderHours>
export const ReminderHours = Type.Object({
    mon: ReminderDayHours,
    tue: ReminderDayHours,
    wed: ReminderDayHours,
    thu: ReminderDayHours,
    fri: ReminderDayHours,
    sat: ReminderDayHours,
    sun: ReminderDayHours
})

export function weekReminderHours(weekday: number[], weekend: number[] = weekday): ReminderHours {
    return {
        mon: weekday,
        tue: weekday,
        wed: weekday,
        thu: weekday,
        fri: weekday,
        sat: weekend,
        sun: weekend
    }
}

export type UserPreferences = Type.Static<typeof UserPreferences>
export const UserPreferences = Type.Object({
    preventWebNotificationPrompt: Type.Boolean(),
    preferredColorsEnabled: Type.Boolean(),
    preferredColors: Type.Array(Type.Enum(Color)),
    colorBlindPalette: Type.Optional(Type.Boolean()),
    reminderHours: Type.Optional(ReminderHours)
})

export type User = Type.Static<typeof User>
export const User = Type.Object({
    id: Type.String(),
    status: Type.Enum(UserStatus),
    deleted: Type.Optional(Type.Boolean()),
    deletedAt: Type.Optional(DateType()),
    username: Type.Optional(Type.String()),
    hasPassword: Type.Optional(Type.Boolean()),
    email: Type.Optional(Type.String()),
    emailVerified: Type.Optional(Type.Boolean()),
    sms: Type.Optional(Type.String()),
    timeZone: Type.Optional(Type.String()),
    roles: Type.Array(Type.Enum(Role)),
    externalIds: Type.Array(Type.String()),
    preferences: Type.Optional(UserPreferences),
    createdAt: Type.Optional(DateType()),
    updatedAt: Type.Optional(DateType())
})

export const ADMIN_ASSIGNABLE_ROLES = [Role.AlphaTester, Role.BetaTester, Role.Developer] as const
export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number]

export function isAdminAssignableRole(role: Role): role is AdminAssignableRole {
    return ADMIN_ASSIGNABLE_ROLES.some((assignable) => assignable === role)
}

export function withAssignedRoles(
    existingRoles: readonly Role[],
    assignedRoles: readonly AdminAssignableRole[]
): Role[] {
    const retained = existingRoles.filter((role) => !isAdminAssignableRole(role))
    const assigned = ADMIN_ASSIGNABLE_ROLES.filter((role) => assignedRoles.includes(role))
    return [...retained, ...assigned]
}
