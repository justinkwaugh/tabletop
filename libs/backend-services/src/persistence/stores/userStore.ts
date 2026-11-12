import { ExternalAuthService, User } from '@tabletop/common'
import { StoredUser } from '../model/storedUser'
import { UpdateValidator } from './validator'
import { TransactionParticipant } from './transaction'

export type PasswordUpdateOptions = {
    validate?: (existing: StoredUser) => void
    participant?: TransactionParticipant
}

export type AbandonedSignUpDeletion = 'deleted' | 'kept' | 'missing'

export interface UserStore {
    findByUsername(username: string): Promise<User | undefined>
    findByEmail(email: string): Promise<User | undefined>
    findByExternalId(externalId: string, service: ExternalAuthService): Promise<User | undefined>
    findById(id: string): Promise<User | undefined>
    findByIds(ids: string[]): Promise<(User | undefined)[]>
    findByUsernameAndPassword(username: string, password: string): Promise<User | undefined>
    findAllUsernames(): Promise<string[]>
    findActiveUsernames(): Promise<string[]>

    createUser(user: User, password?: string, options?: { confirmAge?: boolean }): Promise<User>
    updatePassword(userId: string, password: string, options?: PasswordUpdateOptions): Promise<User>

    updateUser({
        userId,
        fields,
        password,
        currentPassword,
        validator,
        participant,
        confirmAge
    }: {
        userId: string
        fields: Partial<User>
        password?: string
        currentPassword?: string
        validator?: UpdateValidator<StoredUser>
        participant?: TransactionParticipant
        confirmAge?: boolean
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

    deleteUser(userId: string, validate?: (existing: StoredUser) => void): Promise<[User, User]>
    deletePreferences(userId: string): Promise<void>
    findIncompleteUsers(): Promise<User[]>
    deleteAbandonedSignUp(
        userId: string,
        isAbandoned: (existing: StoredUser) => boolean
    ): Promise<AbandonedSignUpDeletion>
}
