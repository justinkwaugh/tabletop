import { UserStore } from '../persistence/stores/userStore.js'
import {
    ExternalAuthService,
    remove,
    Role,
    User,
    UserPreferences,
    UserStatus
} from '@tabletop/common'
import { TokenType, TokenService } from '../tokens/tokenService.js'
import { TaskService } from '../tasks/taskService.js'
import {
    EmailVerificationError,
    InvalidPasswordError,
    InvalidTokenError,
    UnauthenticatedUpdateError
} from './errors.js'
import { AccountChangeType } from '../email/emailService.js'
import { nanoid } from 'nanoid'
import { AuthenticationTokenData, VerificationTokenData } from '../tokens/tokenData.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import uFuzzy from '@leeoniya/ufuzzy'

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

    async updateUser(
        userId: string,
        fields: Partial<User>,
        password?: string,
        currentPassword?: string,
        token?: string
    ): Promise<User> {
        let verificationData: VerificationTokenData | undefined
        if (token) {
            verificationData = await this.tokenService.getData<VerificationTokenData>({
                token,
                expectedType: TokenType.Authentication
            })
            if (!verificationData) {
                throw new InvalidTokenError()
            }
        }

        const [updatedUser, updatedFields, originalUser] = await this.userStore.updateUser({
            userId,
            fields,
            password,
            currentPassword,
            validator: (existingUser, fieldsToUpdate) => {
                // Check token verification data against the existing user
                if (
                    verificationData &&
                    (verificationData.userId !== existingUser.id ||
                        verificationData.email !== existingUser.email)
                ) {
                    throw new InvalidTokenError()
                }

                // No password set on user, and no verification means no sensitive updates
                if (
                    (!existingUser.passwordHash && !verificationData) ||
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
            }
        })

        if (token) {
            await this.tokenService.invalidateToken(token)
        }

        const updateTimestamp = updatedUser.updatedAt ?? new Date()
        if (updatedFields.includes('email') && updatedUser.email) {
            await this.sendVerificationEmail(updatedUser)
            if (originalUser.email) {
                await this.taskService.sendAccountChangeNotificationEmail({
                    email: originalUser.email,
                    changeType: AccountChangeType.Email,
                    timestamp: updateTimestamp
                })
            }
        }
        if (updatedFields.includes('password') && originalUser.email) {
            await this.taskService.sendAccountChangeNotificationEmail({
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

    async updatePassword(userId: string, password: string): Promise<void> {
        const cleanPassword = password.trim()
        if (cleanPassword.length < 12) {
            throw new InvalidPasswordError()
        }

        await this.userStore.updatePassword(userId, cleanPassword)
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
        let user = await this.userStore.findByExternalId(externalId, service)

        // Try by email
        if (!user && email) {
            console.log('No user found by external_id, trying by email')
            const userByEmail = await this.userStore.findByEmail(email)
            if (userByEmail && emailVerified && userByEmail.emailVerified) {
                console.log('Found user by email... linking external_id to user')
                user = await this.userStore.addExternalId({
                    userId: userByEmail.id,
                    externalId,
                    service
                })
            }
        }

        if (!user) {
            user = await this.userStore.createUser(<User>{
                id: nanoid(),
                status: UserStatus.Incomplete,
                email: email,
                emailVerified: emailVerified,
                roles: [Role.User],
                externalIds: [`${service}:${externalId}`]
            })
        }

        return user
    }

    async verifyEmail(token: string): Promise<User> {
        const verificationData = await this.tokenService.getData<VerificationTokenData>({
            token,
            expectedType: TokenType.EmailVerification
        })
        if (!verificationData) {
            throw new InvalidTokenError()
        }

        const { userId, email } = verificationData
        const [updatedUser] = await this.userStore.updateUser({
            userId,
            fields: { emailVerified: true },
            validator: (existingUser) => {
                if (existingUser.email !== email) {
                    throw new InvalidTokenError()
                }

                if (existingUser.emailVerified) {
                    return UpdateValidationResult.Cancel
                }
                return UpdateValidationResult.Proceed
            }
        })

        await this.tokenService.invalidateToken(token)
        return updatedUser
    }

    async sendVerificationEmail(user: User): Promise<void> {
        if (!user.email) {
            throw new EmailVerificationError()
        }
        const userId = user.id
        const email = user.email

        const verificationData = { userId, email }
        const token = await this.tokenService.createToken<VerificationTokenData>({
            type: TokenType.EmailVerification,
            data: verificationData,
            length: 6,
            expiresInSeconds: 60 * 15
        })

        await this.taskService.sendVerificationEmail({ userId, token })

        console.log(`Verification token is ${token}`)
    }

    async sendPasswordResetEmail(user: User): Promise<void> {
        if (!user.email) {
            console.log('User has no email address, cannot send password reset email')
            return
        }
        const userId = user.id

        const authVerificationData = { userId, email: user.email }
        const token = await this.tokenService.createToken<AuthenticationTokenData>({
            type: TokenType.Authentication,
            data: authVerificationData,
            length: 6,
            expiresInSeconds: 60 * 15
        })

        await this.taskService.sendPasswordResetEmail({ userId, token })
        await this.taskService.sendAccountChangeNotificationEmail({
            email: user.email,
            changeType: AccountChangeType.PasswordReset,
            timestamp: new Date()
        })
    }

    async sendEmailAuthVerification(user: User): Promise<void> {
        if (!user.email) {
            console.log('User has no email address, cannot send auth verification email')
            return
        }
        const userId = user.id

        const authVerificationData = { userId, email: user.email }
        const token = await this.tokenService.createToken<AuthenticationTokenData>({
            type: TokenType.Authentication,
            data: authVerificationData,
            length: 6,
            expiresInSeconds: 60 * 15
        })

        await this.taskService.sendAuthVerificationEmail({ userId, token })
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
