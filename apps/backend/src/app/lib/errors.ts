import { BaseError } from '@tabletop/common'

enum BackendError {
    GameVersionMismatch = 'GameVersionMismatch',
    InvalidAction = 'InvalidAction'
}

export class GameVersionMismatchError extends BaseError {
    constructor({
        requestedVersion,
        serverVersion
    }: {
        requestedVersion: string
        serverVersion: string
    }) {
        super({
            name: BackendError.GameVersionMismatch,
            message: `The game logic requested does not match the server version`,
            metadata: { requestedVersion, serverVersion }
        })
    }
}

export class InvalidActionError extends BaseError {
    constructor({ actionType, problem }: { actionType: string; problem: string }) {
        super({
            name: BackendError.InvalidAction,
            message: `Invalid ${actionType} action: ${problem}`,
            metadata: { actionType }
        })
    }
}
