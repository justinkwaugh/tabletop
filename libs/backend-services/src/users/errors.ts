import { BaseError, UserStatus } from '@tabletop/common'

enum UserServiceError {
    AccountUnavailable = 'AccountUnavailableError',
    InvalidPassword = 'InvalidPasswordError',
    EmailVerification = 'EmailVerificationError',
    InvalidTimeZone = 'InvalidTimeZoneError',
    UsernameNotAllowed = 'UsernameNotAllowedError',
    AccountModeration = 'AccountModerationError'
}

export class AccountUnavailableError extends BaseError {
    readonly statusCode = 401

    constructor(status: UserStatus) {
        super({
            name: UserServiceError.AccountUnavailable,
            message:
                status === UserStatus.Inactive
                    ? 'This account has been banned.'
                    : 'This account is no longer available.',
            metadata: { status }
        })
    }
}

export class InvalidPasswordError extends BaseError {
    constructor() {
        super({
            name: UserServiceError.InvalidPassword,
            message: 'Password must be at least 12 characters'
        })
    }
}

export class EmailVerificationError extends BaseError {
    constructor() {
        super({
            name: UserServiceError.EmailVerification,
            message: 'User has no email address'
        })
    }
}

export class EmailChangeError extends BaseError {
    readonly statusCode = 400

    constructor(message: string) {
        super({ name: 'EmailChangeError', message })
    }
}

export class InvalidTimeZoneError extends BaseError {
    constructor(timeZone: string) {
        super({
            name: UserServiceError.InvalidTimeZone,
            message: `Unknown time zone ${timeZone}`,
            metadata: { timeZone }
        })
    }
}

export class UsernameNotAllowedError extends BaseError {
    readonly statusCode = 400

    constructor() {
        super({
            name: UserServiceError.UsernameNotAllowed,
            message: 'That username is not allowed. Please choose a different one.'
        })
    }
}

export class AccountModerationError extends BaseError {
    readonly statusCode = 400

    constructor(message: string) {
        super({ name: UserServiceError.AccountModeration, message })
    }
}
