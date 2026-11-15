import { BaseError } from '@tabletop/common'

export class InvalidLocalGameError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: 'InvalidLocalGameError',
            message: `The game ${id} cannot be reported from a scenario`,
            metadata: { id }
        })
    }
}
