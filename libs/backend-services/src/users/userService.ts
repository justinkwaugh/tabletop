import { UserStore } from '../persistence/stores/userStore.js'
import {
    type AdminAssignableRole,
    canHoldAuthenticatedSession,
    ExternalAuthService,
    remove,
    Role,
    type SensitiveChangeRequest,
    sensitiveChangeOperation,
    User,
    UserPreferences,
    UserStatus,
    withAssignedRoles
} from '@tabletop/common'
import { TaskService } from '../tasks/taskService.js'
import {
    EmailVerificationError,
    InvalidPasswordError,
    InvalidTimeZoneError,
    UnauthenticatedUpdateError
} from './errors.js'
import { requireSessionEligibleAccount } from './accountEligibility.js'
import { AccountChangeType } from '../email/emailService.js'
import { nanoid } from 'nanoid'
import { TokenService, TokenType } from '../tokens/tokenService.js'
import {
    type AuthenticationChallengeClaim,
    formatSetPasswordChallenge,
    InvalidChallengeError,
    type IssuedChallenge
} from '../tokens/authenticationChallenge.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { NotFoundError } from '../persistence/stores/errors.js'
import type { TransactionParticipant } from '../persistence/stores/transaction.js'
import uFuzzy from '@leeoniya/ufuzzy'

type ChallengeProof = { claim: AuthenticationChallengeClaim; consume: TransactionParticipant }

export class UserService {
    private readonly uFuzzy: uFuzzy
    private usernamesInitialized = false
    private usernames: string[] = []

    constructor(
        private readonly userStore: UserStore,
        private readonly tokenService: TokenService,
        private readonly taskService: TaskService
    ) {
        const cmp = new Intl.Collator('en').compare
        const typeAheadSort = (info: uFuzzy.Info, haystack: string[]) => {
            const {
                idx,
                start,
                terms,
                interLft1,
                interLft2,
                interRgt1,
                interRgt2,
                interIns,
                intraIns
            } = info

            return idx
                .map((v, i) => i)
                .sort(
                    (ia, ib) =>
                        // least char intra-fuzz (most contiguous)
                        intraIns[ia] - intraIns[ib] ||
                        // earliest start of match
                        start[ia] - start[ib] ||
                        // shortest match first
                        haystack[idx[ia]].length - haystack[idx[ib]].length ||
                        // most prefix/suffix bounds, boosted by full term matches
                        terms[ib] +
                            interLft2[ib] +
                            0.5 * interLft1[ib] +
                            interRgt2[ib] +
                            0.5 * interRgt1[ib] -
                            (terms[ia] +
                                interLft2[ia] +
                                0.5 * interLft1[ia] +
                                interRgt2[ia] +
                                0.5 * interRgt1[ia]) ||
                        // highest density of match (least span)
                        //	span[ia] - span[ib] ||
                        // highest density of match (least term inter-fuzz)
                        interIns[ia] - interIns[ib] ||
                        // alphabetic
                        cmp(haystack[idx[ia]], haystack[idx[ib]])
                )
        }

        this.uFuzzy = new uFuzzy({ sort: typeAheadSort })
    }

    async getUser(userId: string): Promise<User | undefined> {
        return this.userStore.findById(userId)
    }

    async getUsers(userIds: string[]): Promise<(User | undefined)[]> {
        return this.userStore.findByIds(userIds)
    }

    async getUserByEmail(userId: string): Promise<User | undefined> {
        return this.userStore.findByEmail(userId)
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        return this.userStore.findByUsername(username)
    }

    async getUserByExternalId(
        externalId: string,
        service: ExternalAuthService
    ): Promise<User | undefined> {
        return this.userStore.findByExternalId(externalId, service)
    }

    async getUserByUsernameAndPassword(
        username: string,
        password: string
    ): Promise<User | undefined> {
        return this.userStore.findByUsernameAndPassword(username, password)
    }

    async createUser(user: User, password: string): Promise<User> {
        const cleanPassword = password.trim()
        if (cleanPassword.length < 12) {
            throw new InvalidPasswordError()
        }

        const createdUser = await this.userStore.createUser(user, cleanPassword)

        if (createdUser.email && !createdUser.emailVerified) {
            await this.sendVerificationEmail(createdUser)
        }
        if (createdUser.username) {
            this.usernames.push(createdUser.username)
        }
        return createdUser
    }

    async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<User> {
        const [updatedUser] = await this.userStore.updateUser({
            userId,
            fields: { preferences }
        })
        return updatedUser
    }

    async updateUserTimeZone(
        userId: string,
        timeZone: string,
        { onlyIfUnset = false }: { onlyIfUnset?: boolean } = {}
    ): Promise<User> {
        if (!this.isKnownTimeZone(timeZone)) {
            throw new InvalidTimeZoneError(timeZone)
        }
        const [updatedUser] = await this.userStore.updateUser({
            userId,
            fields: { timeZone },
            validator: (existingUser) =>
                onlyIfUnset && existingUser.timeZone
                    ? UpdateValidationResult.Cancel
                    : UpdateValidationResult.Proceed
        })
        return updatedUser
    }

    private isKnownTimeZone(timeZone: string): boolean {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone })
            return true
        } catch {
            return false
        }
    }

    async updateUser(
        userId: string,
        fields: Partial<User>,
        password?: string,
        currentPassword?: string,
        challenge?: string
    ): Promise<User> {
        const proof = challenge
            ? await this.sensitiveChangeProof(userId, challenge, fields, password)
            : undefined

        const [updatedUser, updatedFields, originalUser] = await this.userStore.updateUser({
            userId,
            fields,
            password,
            currentPassword,
            validator: (existingUser, fieldsToUpdate) => {
                if (proof && existingUser.email !== proof.claim.email) {
                    throw new InvalidChallengeError('binding')
                }

                // No password set on user, and no verification means no sensitive updates
                if (
                    (!existingUser.passwordHash && !proof) ||
                    (existingUser.passwordHash && !currentPassword)
                ) {
                    // Cannot change email
                    if (fieldsToUpdate.email && existingUser.email) {
                        throw new UnauthenticatedUpdateError('email')
                    }

                    // Cannot set or change password
                    if (fieldsToUpdate.passwordHash) {
                        throw new UnauthenticatedUpdateError('password')
                    }
                }

                return UpdateValidationResult.Proceed
            },
            participant: proof?.consume
        })

        const updateTimestamp = updatedUser.updatedAt ?? new Date()
        if (updatedFields.includes('email') && updatedUser.email) {
            await this.sendVerificationEmail(updatedUser)
            if (originalUser.email) {
                await this.notifyAccountChange(userId, {
                    email: originalUser.email,
                    changeType: AccountChangeType.Email,
                    timestamp: updateTimestamp
                })
            }
        }
        if (updatedFields.includes('password') && originalUser.email) {
            await this.notifyAccountChange(userId, {
                email: originalUser.email,
                changeType: AccountChangeType.Password,
                timestamp: updateTimestamp
            })
        }

        if (updatedFields.includes('username')) {
            remove(this.usernames, originalUser.username)
            if (updatedUser.username) {
                this.usernames.push(updatedUser.username)
            }
        }

        return updatedUser
    }

    private async sensitiveChangeProof(
        userId: string,
        challenge: string,
        fields: Partial<User>,
        password: string | undefined
    ): Promise<ChallengeProof> {
        const account = await this.userStore.findById(userId)
        if (!account?.email) {
            throw new InvalidChallengeError('account')
        }
        const claim: AuthenticationChallengeClaim = {
            type: TokenType.SensitiveChange,
            userId,
            email: account.email,
            operation: sensitiveChangeOperation({
                email: fields.email,
                password: Boolean(password)
            })
        }
        return { claim, consume: this.tokenService.consumeChallenge(challenge, claim) }
    }

    async linkExternalAccount({
        userId,
        externalId,
        service
    }: {
        userId: string
        externalId: string
        service: ExternalAuthService
    }): Promise<User> {
        return await this.userStore.addExternalId({ userId, externalId, service })
    }

    async unlinkExternalAccount({
        userId,
        externalId
    }: {
        userId: string
        externalId: string
    }): Promise<User> {
        const cleanExternalId = externalId.trim()
        return await this.userStore.removeExternalId(userId, cleanExternalId)
    }

    async setPassword({
        userId,
        secret,
        password
    }: {
        userId: string
        secret: string
        password: string
    }): Promise<User> {
        const cleanPassword = password.trim()
        if (cleanPassword.length < 12) {
            throw new InvalidPasswordError()
        }

        const account = await this.userStore.findById(userId)
        if (!account?.email || !canHoldAuthenticatedSession(account)) {
            throw new InvalidChallengeError('account')
        }
        const claim: AuthenticationChallengeClaim = {
            type: TokenType.PasswordReset,
            userId,
            email: account.email
        }
        const updatedUser = await this.userStore.updatePassword(userId, cleanPassword, {
            validate: (existingUser) => this.requireChallengeAccount(existingUser, claim),
            participant: this.tokenService.consumeChallenge(secret, claim)
        })
        await this.notifyAccountChange(userId, {
            email: claim.email,
            changeType: AccountChangeType.Password,
            timestamp: updatedUser.updatedAt ?? new Date()
        })
        return updatedUser
    }

    // The Account change has committed by the time its Attention Notice is dispatched; the notice
    // is best effort (Notification Delivery), so a failed dispatch is reported, not the operation.
    private async notifyAccountChange(
        userId: string,
        notification: { email: string; changeType: AccountChangeType; timestamp: Date }
    ): Promise<void> {
        try {
            await this.taskService.sendAccountChangeNotificationEmail(notification)
        } catch (error) {
            console.error('Account change notification was not dispatched', {
                userId,
                changeType: notification.changeType,
                error: error instanceof Error ? error.name : typeof error
            })
        }
    }

    private requireChallengeAccount(
        existingUser: StoredUser,
        claim: AuthenticationChallengeClaim
    ): void {
        if (!canHoldAuthenticatedSession(existingUser) || existingUser.email !== claim.email) {
            throw new InvalidChallengeError('account')
        }
    }

    async handleExternalAuth({
        service,
        externalId,
        email,
        emailVerified
    }: {
        service: ExternalAuthService
        externalId: string
        email?: string
        emailVerified?: boolean
    }): Promise<User> {
        const linkedUser = await this.userStore.findByExternalId(externalId, service)
        if (linkedUser) {
            requireSessionEligibleAccount(linkedUser)
            return linkedUser
        }

        if (email) {
            console.log('No user found by external_id, trying by email')
            const userByEmail = await this.userStore.findByEmail(email)
            if (userByEmail && emailVerified && userByEmail.emailVerified) {
                requireSessionEligibleAccount(userByEmail)
                console.log('Found user by email... linking external_id to user')
                return await this.userStore.addExternalId({
                    userId: userByEmail.id,
                    externalId,
                    service
                })
            }
        }

        return await this.userStore.createUser(<User>{
            id: nanoid(),
            status: UserStatus.Incomplete,
            email: email,
            emailVerified: emailVerified,
            roles: [Role.User],
            externalIds: [`${service}:${externalId}`]
        })
    }

    async verifyEmail(user: User, code: string): Promise<User> {
        if (!user.email) {
            throw new InvalidChallengeError('account')
        }
        const claim: AuthenticationChallengeClaim = {
            type: TokenType.EmailVerification,
            userId: user.id,
            email: user.email
        }
        const [updatedUser] = await this.userStore.updateUser({
            userId: user.id,
            fields: { emailVerified: true },
            validator: (existingUser) => {
                this.requireChallengeAccount(existingUser, claim)
                return UpdateValidationResult.Proceed
            },
            participant: this.tokenService.consumeChallenge(code, claim)
        })
        return updatedUser
    }

    async sendVerificationEmail(user: User): Promise<IssuedChallenge> {
        if (!user.email) {
            throw new EmailVerificationError()
        }
        const issued = await this.tokenService.issueChallenge({
            type: TokenType.EmailVerification,
            userId: user.id,
            email: user.email
        })
        await this.taskService.sendVerificationEmail({ userId: user.id, token: issued.secret })
        return issued
    }

    async sendPasswordResetEmail(user: User): Promise<IssuedChallenge | undefined> {
        if (!user.email || !canHoldAuthenticatedSession(user)) {
            return undefined
        }
        const issued = await this.tokenService.issueChallenge({
            type: TokenType.PasswordReset,
            userId: user.id,
            email: user.email
        })
        await this.taskService.sendPasswordResetEmail({
            userId: user.id,
            token: formatSetPasswordChallenge({ userId: user.id, secret: issued.secret })
        })
        await this.notifyAccountChange(user.id, {
            email: user.email,
            changeType: AccountChangeType.PasswordReset,
            timestamp: new Date()
        })
        return issued
    }

    async sendSensitiveChangeChallenge(
        user: User,
        request: SensitiveChangeRequest
    ): Promise<IssuedChallenge> {
        if (!user.email) {
            throw new EmailVerificationError()
        }
        const issued = await this.tokenService.issueChallenge({
            type: TokenType.SensitiveChange,
            userId: user.id,
            email: user.email,
            operation: sensitiveChangeOperation(request)
        })
        await this.taskService.sendAuthVerificationEmail({ userId: user.id, token: issued.secret })
        return issued
    }

    async searchUsers(query: string): Promise<User[]> {
        const trimmed = query.trim()
        if (!trimmed) return []
        if (trimmed.includes('@')) {
            const user = await this.userStore.findByEmail(trimmed)
            return user ? [user] : []
        }
        const usernames = await this.searchUsernames(trimmed)
        const users = await Promise.all(
            usernames.map((username) => this.userStore.findByUsername(username))
        )
        return users.filter((user) => user !== undefined)
    }

    async assignRoles(userId: string, assignedRoles: AdminAssignableRole[]): Promise<User> {
        const user = await this.userStore.findById(userId)
        if (!user) {
            throw new NotFoundError({ type: 'User', id: userId })
        }
        const [updatedUser] = await this.userStore.updateUser({
            userId,
            fields: { roles: withAssignedRoles(user.roles, assignedRoles) }
        })
        return updatedUser
    }

    async searchUsernames(query: string): Promise<string[]> {
        await this.initializeUsernames()
        const [indexes, info, order] = this.uFuzzy.search(this.usernames, query.trim())
        if (info && order) {
            return order.map((index) => this.usernames[info.idx[index]]).slice(0, 10)
        } else {
            return indexes?.map((index) => this.usernames[index]).slice(0, 10) ?? []
        }
    }

    extractExternalId(user: User, service: ExternalAuthService): string | undefined {
        const externalId = user.externalIds?.find((id) => id.startsWith(`${service}:`))
        if (!externalId) {
            return undefined
        }
        return externalId.split(':')[1]
    }

    private async initializeUsernames(): Promise<void> {
        if (this.usernamesInitialized) {
            return
        }
        this.usernames = await this.userStore.findAllUsernames()
        this.usernamesInitialized = true
    }
}
