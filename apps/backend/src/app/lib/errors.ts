import { BaseError } from '@tabletop/common'

enum BackendError {
    GameVersionMismatch = 'GameVersionMismatch'
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
