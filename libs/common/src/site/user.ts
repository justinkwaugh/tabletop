import { Type, type Static } from '@sinclair/typebox'

export enum Role {
    User = 'user',
    Developer = 'developer',
    Admin = 'admin'
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

export type User = Static<typeof User>
export const User = Type.Object({
    id: Type.String(),
    status: Type.Enum(UserStatus),
    deleted: Type.Optional(Type.Boolean()),
    deletedAt: Type.Optional(Type.Date()),
    username: Type.Optional(Type.String()),
    hasPassword: Type.Optional(Type.Boolean()),
    email: Type.Optional(Type.String()),
    emailVerified: Type.Optional(Type.Boolean()),
    sms: Type.Optional(Type.String()),
    roles: Type.Array(Type.Enum(Role)),
    externalIds: Type.Array(Type.String()),
    createdAt: Type.Optional(Type.Date()),
    updatedAt: Type.Optional(Type.Date())
})
