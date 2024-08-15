import { ExternalAuthService, User } from '@tabletop/common'
import { StoredUser } from '../model/storedUser'
import { UpdateValidator } from './validator'

export interface UserStore {
    findByUsername(username: string): Promise<User | undefined>
    findByEmail(email: string): Promise<User | undefined>
    findByExternalId(externalId: string, service: ExternalAuthService): Promise<User | undefined>
    findById(id: string): Promise<User | undefined>
    findByUsernameAndPassword(username: string, password: string): Promise<User | undefined>

    createUser(user: User, password?: string): Promise<User>
    updatePassword(userId: string, password: string): Promise<void>

    updateUser({
        userId,
        fields,
        password,
        currentPassword,
        validator
    }: {
        userId: string
        fields: Partial<User>
        password?: string
        currentPassword?: string
        validator?: UpdateValidator<StoredUser>
    }): Promise<[User, string[], User]>

    addExternalId({
        userId,
        externalId,
        service
    }: {
        userId: string
        externalId: string
        service: ExternalAuthService
    }): Promise<User>
    removeExternalId(userId: string, externalId: string): Promise<User>
}
