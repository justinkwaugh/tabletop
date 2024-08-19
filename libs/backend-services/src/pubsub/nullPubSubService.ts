import { PubSubService } from './pubSubService.js'

/**
 * A null implementation of the PubSubService that does nothing.
 */
export class NullPubSubService implements PubSubService {
    async publishMessage(): Promise<void> {}
    async subscribeToTopics(): Promise<void> {}
    async subscribeToTopicPatterns(): Promise<void> {}
    async unsubscribe(): Promise<void> {}
}
