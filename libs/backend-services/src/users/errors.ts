import { BaseError, UserStatus } from '@tabletop/common'

enum UserServiceError {
    AccountUnavailable = 'AccountUnavailableError',
    InvalidPassword = 'InvalidPasswordError',
    EmailVerification = 'EmailVerificationError',
    InvalidTimeZone = 'InvalidTimeZoneError'
}

export class AccountUnavailableError extends BaseError {
    readonly statusCode = 401

    constructor(status: UserStatus) {
        super({
            name: UserServiceError.AccountUnavailable,
            message: 'Account cannot hold an Authenticated Session',
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

export class InvalidTimeZoneError extends BaseError {
    constructor(timeZone: string) {
        super({
            name: UserServiceError.InvalidTimeZone,
            message: `Unknown time zone ${timeZone}`,
            metadata: { timeZone }
        })
    }
}
