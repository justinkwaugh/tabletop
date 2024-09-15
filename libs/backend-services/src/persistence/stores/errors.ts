import { BaseError } from '@tabletop/common'

enum StorageError {
    AlreadyExists = 'AlreadyExistsError',
    MissingRequiredField = 'MissingRequiredFieldError',
    InvalidId = 'InvalidIDError',
    NotFound = 'NotFoundError',
    AuthenticationVerificationFailed = 'AuthenticationVerificationFailedError',
    UpdateCollision = 'UpdateCollisionError',
    Unknown = 'UnknownStorageError'
}

export class AlreadyExistsError extends BaseError {
    constructor({
        type,
        id,
        field,
        cause
    }: {
        type: string
        id: string
        field: string
        cause?: Error
    }) {
        super({
            name: StorageError.AlreadyExists,
            message: `Object of type ${type} with id ${id} and field ${field} already exists`,
            metadata: { type, id, field },
            cause
        })
    }
}

export class MissingRequiredFieldError extends BaseError {
    constructor({
        type,
        id,
        field,
        cause
    }: {
        type: string
        id: string
        field: string
        cause?: Error
    }) {
        super({
            name: StorageError.MissingRequiredField,
            message: `Object of type ${type} with id ${id} is missing data for field ${field}`,
            metadata: { type, id, field },
            cause
        })
    }
}
export class InvalidIdError extends BaseError {
    constructor({ type, id }: { type: string; id: string }) {
        super({
            name: StorageError.InvalidId,
            message: `Object of type ${type} has an invalid id ${id}`,
            metadata: { type, id }
        })
    }
}

export class NotFoundError extends BaseError {
    constructor({ type, id }: { type: string; id: string }) {
        super({
            name: StorageError.NotFound,
            message: `Object of type ${type} with id ${id} was not found`,
            metadata: { type, id }
        })
    }
}

export class AuthenticationVerificationFailedError extends BaseError {
    constructor({ type, id }: { type: string; id: string }) {
        super({
            name: StorageError.AuthenticationVerificationFailed,
            message: `Attempt to update object of type ${type} with id ${id} failed authentication check`,
            metadata: { type, id }
        })
    }
}

export class UnknownStorageError extends BaseError {
    constructor({ type, id, cause }: { type: string; id: string; cause?: Error }) {
        super({
            name: StorageError.Unknown,
            message: `Storage action for object of type ${type} with id ${id} failed for an unknown reason`,
            metadata: { type, id },
            cause
        })
    }
}

export class UpdateCollisionError extends BaseError {
    constructor({ type, id }: { type: string; id: string }) {
        super({
            name: StorageError.UpdateCollision,
            message: `Object of type ${type} with id ${id} was updated by another request`,
            metadata: { type, id }
        })
    }
}
