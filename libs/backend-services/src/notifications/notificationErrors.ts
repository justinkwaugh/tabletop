import { BaseError } from '@tabletop/common'

export class UnsupportedWebPushSubscriptionError extends BaseError {
    constructor(reason: string) {
        super({
            name: 'UnsupportedWebPushSubscriptionError',
            message: `Web Push subscription rejected: ${reason}`,
            metadata: { reason }
        })
    }
}

export class RegistrationLimitExceededError extends BaseError {
    constructor({ transport, topic, limit }: { transport: string; topic: string; limit: number }) {
        super({
            name: 'RegistrationLimitExceededError',
            message: `Topic already holds the maximum of ${limit} ${transport} registrations`,
            metadata: { transport, topic, limit }
        })
    }
}

export class BlockedDestinationError extends BaseError {
    constructor({ hostname, addresses }: { hostname: string; addresses: string[] }) {
        super({
            name: 'BlockedDestinationError',
            message: `Refused to connect to ${hostname}: ${addresses.join(', ') || 'no address'} is not a public internet address`,
            metadata: { hostname, addresses }
        })
    }
}

export class DestinationDeadlineError extends BaseError {
    constructor({ hostname, deadlineMs }: { hostname: string; deadlineMs: number }) {
        super({
            name: 'DestinationDeadlineError',
            message: `Connection to ${hostname} exceeded its ${deadlineMs} ms deadline`,
            metadata: { hostname, deadlineMs }
        })
    }
}
