import { BaseError, ExternalAuthService, Role, User, UserStatus } from '@tabletop/common'
import {
    CollectionReference,
    DocumentData,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'
import { StoredUser } from '../model/storedUser.js'
import bcrypt from 'bcrypt'
import {
    AlreadyExistsError,
    AuthenticationVerificationFailedError,
    InvalidIdError,
    NotFoundError,
    UnknownStorageError
} from '../stores/errors.js'

import { UserStore } from '../stores/userStore.js'
import { isFirestoreError } from './errors.js'
import { UpdateValidationResult, UpdateValidator } from '../stores/validator.js'
import { RedisCacheService } from '../../cache/cacheService.js'

export class FirestoreUserStore implements UserStore {
    readonly users: CollectionReference
    readonly userUsernames: CollectionReference
    readonly userExternalIds: CollectionReference
    readonly userEmails: CollectionReference

    constructor(
        private cacheService: RedisCacheService,
        private firestore: Firestore,
        private local: boolean = false
    ) {
        this.users = firestore.collection('users').withConverter<StoredUser>(userConverter)
        this.userUsernames = firestore.collection('userUsernames')
        this.userExternalIds = firestore.collection('userExternalIds')
        this.userEmails = firestore.collection('userEmails')
    }

    async findByUsername(username: string): Promise<User | undefined> {
        try {
            const cleanUsername = this.trimLowerString(username)
            const user = await this.findByUsernameIncludingPasswordHash(cleanUsername)
            this.recordRead()
            return this.sanitize(user)
        } catch (error) {
            this.handleError(error, username)
            throw Error('unreachable')
        }
    }

    async findByEmail(email: string): Promise<User | undefined> {
        const cleanEmail = email.trim().toLowerCase()
        try {
            const userDocs = await this.users.where('email', '==', cleanEmail).get()
            const user = this.onlyOne<StoredUser>(userDocs.docs, 'email')
            this.recordRead()
            return this.sanitize(user)
        } catch (error) {
            this.handleError(error, email)
            throw Error('unreachable')
        }
    }

    async findByExternalId(
        externalId: string,
        service: ExternalAuthService
    ): Promise<User | undefined> {
        const compositeId = `${service}:${externalId}`
        try {
            const userDocs = await this.users
                .where('externalIds', 'array-contains', compositeId)
                .get()
            const user = this.onlyOne<StoredUser>(userDocs.docs, 'email')
            this.recordRead()
            return this.sanitize(user)
        } catch (error) {
            this.handleError(error, externalId)
            throw Error('unreachable')
        }
    }

    async findById(id: string): Promise<User | undefined> {
        const cacheKey = this.makeUserCacheKey(id)

        const getUser = async () => {
            try {
                const doc = this.users.doc(id)
                const user = (await doc.get()).data() as StoredUser
                this.recordRead()
                return this.sanitize(user)
            } catch (error) {
                this.handleError(error, id)
                throw Error('unreachable')
            }
        }

        return await this.cacheService.cachingGet(cacheKey, getUser)
    }

    async findByUsernameAndPassword(username: string, password: string): Promise<User | undefined> {
        const cleanUsername = this.trimLowerString(username)
        const user = await this.findByUsernameIncludingPasswordHash(cleanUsername)
        if (!user) {
            return undefined
        }

        if (await this.validatePassword(password, user.passwordHash)) {
            return this.sanitize(user)
        }

        return undefined
    }

    async findAllUsernames(): Promise<string[]> {
        try {
            const usernames = await this.userUsernames.listDocuments()
            return usernames.map((doc) => doc.id)
        } catch (error) {
            this.handleError(error, 'all')
            throw Error('unreachable')
        }
    }

    async createUser(user: User, password?: string): Promise<User> {
        const newStoredUser = structuredClone(user) as StoredUser

        // Set dates
        newStoredUser.createdAt = new Date()
        newStoredUser.updatedAt = new Date()

        // Clean username
        if (newStoredUser.username) {
            console.log('Trimming username')
            newStoredUser.username = newStoredUser.username?.trim()
            newStoredUser.cleanUsername = this.trimLowerString(newStoredUser.username)
        }

        // Clean email
        if (newStoredUser.email) {
            newStoredUser.email = this.trimLowerString(newStoredUser.email)
        }

        // Ensure fields can be used for unique constraints
        if (newStoredUser.cleanUsername && !this.isValidId(newStoredUser.cleanUsername)) {
            throw new InvalidIdError({ type: 'username', id: newStoredUser.cleanUsername })
        }

        if (newStoredUser.email && !this.isValidId(newStoredUser.email)) {
            throw new InvalidIdError({ type: 'email', id: newStoredUser.email })
        }

        newStoredUser.externalIds.forEach((externalId: string) => {
            if (!this.isValidId(externalId)) {
                throw new InvalidIdError({ type: 'externalId', id: externalId })
            }
        })

        if (password) {
            newStoredUser.passwordHash = await this.hashPassword(password)
        }

        const transactionBody = async (
            transaction: FirebaseFirestore.Transaction
        ): Promise<StoredUser> => {
            // Unique fields
            if (newStoredUser.cleanUsername) {
                transaction.create(this.userUsernames.doc(newStoredUser.cleanUsername!), {})
            }

            if (newStoredUser.email) {
                transaction.create(this.userEmails.doc(newStoredUser.email!), {})
            }

            newStoredUser.externalIds.forEach((externalId: string) => {
                transaction.create(this.userExternalIds.doc(externalId), {})
            })

            if (this.local) {
                const snapshot = await this.users.count().get()
                if (snapshot.data().count === 0) {
                    console.log('Adding admin to first user')
                    newStoredUser.roles.push(Role.Admin)
                }
            }

            console.log('creating: ', newStoredUser)
            transaction.create(this.users.doc(newStoredUser.id), newStoredUser)
            return newStoredUser
        }

        const userCacheKey = this.makeUserCacheKey(user.id)

        try {
            const user = await this.cacheService.lockWhileWriting([userCacheKey], async () =>
                this.users.firestore.runTransaction(transactionBody)
            )
            return this.sanitize(user) as User
        } catch (error) {
            this.handleError(error, user.id)
            throw Error('unreachable')
        }
    }

    async updatePassword(userId: string, password: string): Promise<void> {
        try {
            const passwordHash = await this.hashPassword(password)
            await this.users.firestore.runTransaction(async (transaction) => {
                transaction.update(this.users.doc(userId), { passwordHash })
            })
        } catch (error) {
            this.handleError(error, userId)
        }
    }

    async updateUser({
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
    }): Promise<[User, string[], User]> {
        const updateFields = structuredClone(fields) as Partial<StoredUser>

        if (updateFields.username) {
            updateFields.username = updateFields.username.trim()
            updateFields.cleanUsername = this.trimLowerString(updateFields.username)

            if (!this.isValidId(updateFields.username)) {
                throw new InvalidIdError({ type: 'username', id: updateFields.username })
            }
        }

        if (updateFields.email) {
            updateFields.email = this.trimLowerString(updateFields.email)
            if (!this.isValidId(updateFields.email)) {
                throw new InvalidIdError({ type: 'email', id: updateFields.email })
            }
        }

        if (updateFields.externalIds) {
            updateFields.externalIds.forEach((externalId: string) => {
                if (!this.isValidId(externalId)) {
                    throw new InvalidIdError({ type: 'externalId', id: externalId })
                }
            })
        }

        if (password) {
            updateFields.passwordHash = await this.hashPassword(password)
        }

        const transactionBody = async (
            transaction: FirebaseFirestore.Transaction
        ): Promise<[StoredUser, string[], StoredUser]> => {
            const fieldsToUpdate = structuredClone(updateFields)
            const updatedFields: string[] = []
            const existingUser = (
                await transaction.get(this.users.doc(userId))
            ).data() as StoredUser
            this.recordRead()
            if (!existingUser) {
                throw new NotFoundError({ type: 'User', id: userId })
            }

            if (validator) {
                switch (validator(existingUser, fieldsToUpdate)) {
                    case UpdateValidationResult.Cancel:
                        return [existingUser, [], existingUser]
                }
            }

            // If a current password was provided, check it
            if (
                currentPassword &&
                !(await this.validatePassword(currentPassword, existingUser.passwordHash))
            ) {
                throw new AuthenticationVerificationFailedError({
                    type: 'User',
                    id: userId
                })
            }

            const updatedUser = structuredClone(existingUser)

            if (fieldsToUpdate.username && existingUser.username !== fieldsToUpdate.username) {
                if (existingUser.cleanUsername !== fieldsToUpdate.cleanUsername) {
                    if (existingUser.cleanUsername) {
                        transaction.delete(this.userUsernames.doc(existingUser.cleanUsername!))
                    }
                    transaction.create(this.userUsernames.doc(fieldsToUpdate.cleanUsername!), {})
                }
                updatedUser.username = fieldsToUpdate.username
                updatedUser.cleanUsername = fieldsToUpdate.cleanUsername
                updatedFields.push('username')
            }

            if (fieldsToUpdate.email && existingUser.email !== fieldsToUpdate.email) {
                if (existingUser.email) {
                    transaction.delete(this.userEmails.doc(existingUser.email!))
                }
                transaction.create(this.userEmails.doc(fieldsToUpdate.email!), {})
                updatedUser.email = fieldsToUpdate.email
                fieldsToUpdate.emailVerified = false

                updatedFields.push('email')
            }

            if (fieldsToUpdate.preferences) {
                updatedUser.preferences = fieldsToUpdate.preferences
                updatedFields.push('preferences')
            }

            if (
                fieldsToUpdate.emailVerified !== undefined &&
                existingUser.emailVerified !== fieldsToUpdate.emailVerified
            ) {
                updatedUser.emailVerified = fieldsToUpdate.emailVerified
                updatedFields.push('emailVerified')
            }

            if (fieldsToUpdate.externalIds) {
                // update for services using prefix, which is pretty annoying...
            }

            if (
                fieldsToUpdate.passwordHash &&
                existingUser.passwordHash !== fieldsToUpdate.passwordHash
            ) {
                updatedUser.passwordHash = fieldsToUpdate.passwordHash
                updatedFields.push('password')
            }

            if (
                updatedUser.cleanUsername &&
                updatedUser.email &&
                updatedUser.emailVerified === true
            ) {
                if (updatedUser.status !== UserStatus.Active) {
                    fieldsToUpdate.status = UserStatus.Active
                    updatedUser.status = fieldsToUpdate.status
                    updatedFields.push('status')
                }
            } else if (updatedUser.status !== UserStatus.Incomplete) {
                fieldsToUpdate.status = UserStatus.Incomplete
                updatedUser.status = fieldsToUpdate.status
                updatedFields.push('status')
            }

            if (updatedFields.length > 0) {
                fieldsToUpdate.updatedAt = new Date()
                updatedUser.updatedAt = fieldsToUpdate.updatedAt
                updatedFields.push('updatedAt')

                transaction.update(this.users.doc(updatedUser.id), fieldsToUpdate)
            }

            return [updatedUser, updatedFields, existingUser]
        }

        const userCacheKey = this.makeUserCacheKey(userId)

        try {
            const [updatedUser, updatedFields, existingUser] =
                await this.cacheService.lockWhileWriting([userCacheKey], async () =>
                    this.users.firestore.runTransaction(transactionBody)
                )

            return [
                this.sanitize(updatedUser) as User,
                updatedFields,
                this.sanitize(existingUser) as User
            ]
        } catch (error) {
            this.handleError(error, userId)
            throw Error('unreachable')
        }
    }

    async addExternalId({
        userId,
        externalId,
        service
    }: {
        userId: string
        externalId: string
        service: ExternalAuthService
    }): Promise<User> {
        if (!this.isValidId(externalId)) {
            throw new InvalidIdError({ type: 'externalId', id: externalId })
        }

        const compositeId = `${service}:${externalId}`
        const transactionBody = async (
            transaction: FirebaseFirestore.Transaction
        ): Promise<StoredUser> => {
            const userToUpdate = (
                await transaction.get(this.users.doc(userId))
            ).data() as StoredUser
            this.recordRead()
            if (!userToUpdate) {
                throw new NotFoundError({ type: 'User', id: userId })
            }

            if (userToUpdate.externalIds.includes(compositeId)) {
                throw Error(
                    `User with id ${userId} already is linked to ${service} account ${externalId}`
                )
            }

            const storedUser = userToUpdate
            storedUser.externalIds.push(compositeId)

            const doc = this.users.doc(storedUser.id)
            transaction.update(doc, { externalIds: storedUser.externalIds })

            transaction.create(this.userExternalIds.doc(compositeId), {})
            return storedUser
        }

        const userCacheKey = this.makeUserCacheKey(userId)

        try {
            const user = await this.cacheService.lockWhileWriting([userCacheKey], async () =>
                this.users.firestore.runTransaction(transactionBody)
            )
            return this.sanitize(user) as User
        } catch (error) {
            this.handleError(error, userId)
            throw Error('unreachable')
        }
    }

    async removeExternalId(userId: string, externalId: string): Promise<User> {
        const transactionBody = async (
            transaction: FirebaseFirestore.Transaction
        ): Promise<StoredUser> => {
            const userToUpdate = (
                await transaction.get(this.users.doc(userId))
            ).data() as StoredUser
            this.recordRead()
            if (!userToUpdate) {
                throw new NotFoundError({ type: 'User', id: userId })
            }

            const storedUser = structuredClone(userToUpdate)
            storedUser.externalIds = storedUser.externalIds.filter((id) => id !== externalId)

            const doc = this.users.doc(storedUser.id)
            transaction.update(doc, { externalIds: storedUser.externalIds })
            transaction.delete(this.userExternalIds.doc(externalId), {})
            return storedUser
        }

        const userCacheKey = this.makeUserCacheKey(userId)

        try {
            const user = await this.cacheService.lockWhileWriting([userCacheKey], async () =>
                this.users.firestore.runTransaction(transactionBody)
            )
            return this.sanitize(user) as User
        } catch (error) {
            this.handleError(error, userId)
            throw Error('unreachable')
        }
    }

    private async findByUsernameIncludingPasswordHash(
        username: string
    ): Promise<StoredUser | undefined> {
        try {
            const userDocs = await this.users.where('cleanUsername', '==', username).get()
            this.recordRead()
            return this.onlyOne(userDocs.docs, 'username')
        } catch (error) {
            this.handleError(error, username)
            throw Error('unreachable')
        }
    }

    private onlyOne<T>(docs: DocumentData[], fieldName: string): T | undefined {
        if (docs.length === 0) {
            return undefined
        }
        if (docs.length > 1) {
            throw Error(`Multiple entries with the same ${fieldName}`)
        }
        return docs[0].data() as T
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
    }

    private sanitize(user?: StoredUser): User | undefined {
        if (!user) return user

        if (user.passwordHash) {
            user.hasPassword = true
        } else {
            user.hasPassword = false
        }

        delete user.passwordHash
        delete user.cleanUsername
        return user
    }

    async hashPassword(password: string) {
        const trimmed = password.trim()
        return await bcrypt.hash(trimmed, 10)
    }

    async validatePassword(password: string, passwordHash?: string) {
        if (!passwordHash) {
            return false
        }

        const trimmed = password.trim()
        try {
            return await bcrypt.compare(trimmed, passwordHash)
        } catch {
            return false
        }
    }

    private handleError(error: unknown, id: string) {
        console.log(error)
        if (error instanceof BaseError) {
            throw error
        } else if (isFirestoreError(error) && error.code === 6) {
            // Extract the field from the error message
            let field = 'id'
            if (error.message.includes('userUsernames')) {
                field = 'username'
            } else if (error.message.includes('userEmails')) {
                field = 'email'
            } else if (error.message.includes('userExternalIds')) {
                field = 'externalId'
            }
            throw new AlreadyExistsError({
                type: 'User',
                id,
                field,
                cause: error instanceof Error ? error : undefined
            })
        } else {
            throw new UnknownStorageError({
                type: 'User',
                id,
                cause: error instanceof Error ? error : undefined
            })
        }
    }

    private trimLowerString(value: string): string {
        return value.trim().toLowerCase()
    }

    private recordRead() {
        try {
            this.cacheService.incrementValue('db-read-user').catch((error) => {
                console.error('Failed to increment user reads', error)
            })
        } catch (error) {
            console.error('Failed to increment user reads', error)
        }
    }

    private makeUserCacheKey(userId: string) {
        return `user-${userId}`
    }
}

const userConverter = {
    toFirestore(user: StoredUser): PartialWithFieldValue<StoredUser> {
        return user
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): StoredUser {
        const data = snapshot.data() as StoredUser
        // Convert back to dates
        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        data.deletedAt = data.deletedAt ? (data.deletedAt as Timestamp).toDate() : undefined

        return data
    }
}
