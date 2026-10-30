import type { MessagePublisher } from '../pubsub/pubSubService.js'

// The relay's control feed: never a Topic, never granted in a token, never forwarded.
export const REALTIME_CONTROL_CHANNEL = 'realtime-control'

export type RealtimeRevocation = {
    revoke: string
    topics?: string[]
    at: number
}

// Tells the realtime relay, through Redis, when an account's open connections must lose
// what a token granted them: every connection on an account revocation, or only the named
// Topics on a topic revocation, which keeps the connections and their other Topics. A
// message that cannot be published is logged and dropped: the relay bounds every privileged
// grant by the end carried in its token, so a lost message delays the end, never removes it,
// and a relay without Redis has already closed every connection.
export class RealtimeControl {
    constructor(
        private readonly publisher: MessagePublisher | undefined,
        private readonly now: () => Date = () => new Date()
    ) {}

    async revokeAccount(userId: string): Promise<void> {
        await this.publish({ revoke: userId, at: this.at() }, 'account')
    }

    async revokeTopics(userId: string, topics: readonly string[]): Promise<void> {
        if (topics.length === 0) {
            return
        }
        await this.publish({ revoke: userId, topics: [...topics], at: this.at() }, 'topics')
    }

    private at(): number {
        return this.now().getTime() / 1000
    }

    private async publish(message: RealtimeRevocation, kind: 'account' | 'topics') {
        if (!this.publisher) {
            return
        }
        try {
            await this.publisher.publishMessage({
                topic: REALTIME_CONTROL_CHANNEL,
                message: JSON.stringify(message)
            })
        } catch (error) {
            console.warn('Realtime revocation not published', { kind, error })
        }
    }
}
