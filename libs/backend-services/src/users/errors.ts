import { BaseError } from '@tabletop/common'

enum UserServiceError {
    InvalidPassword = 'InvalidPasswordError',
    InvalidToken = 'InvalidTokenError',
    EmailVerification = 'EmailVerificationError',
    UnauthenticatedUpdate = 'UnauthenticatedUpdateError',
    InvalidTimeZone = 'InvalidTimeZoneError'
}

export class InvalidPasswordError extends BaseError {
    constructor() {
        super({
            name: UserServiceError.InvalidPassword,
            message: 'Password must be at least 12 characters'
        })
    }
}

export class InvalidTokenError extends BaseError {
    constructor() {
        super({
            name: UserServiceError.InvalidToken,
            message: 'Invalid or expired token'
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

export class UnauthenticatedUpdateError extends BaseError {
    constructor(field: string) {
        super({
            name: UserServiceError.UnauthenticatedUpdate,
            message: `Current password required to update ${field}`,
            metadata: { field }
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
