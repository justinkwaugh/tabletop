export const PUSH_SUBSCRIPTION_CHANGED = 'pushSubscriptionChanged'

export type PushSubscriptionChangedMessage = {
    type: typeof PUSH_SUBSCRIPTION_CHANGED
    oldEndpoint?: string
}

export function pushSubscriptionChangedMessage(
    oldEndpoint?: string
): PushSubscriptionChangedMessage {
    return { type: PUSH_SUBSCRIPTION_CHANGED, oldEndpoint }
}

export function isPushSubscriptionChangedMessage(
    data: unknown
): data is PushSubscriptionChangedMessage {
    return (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === PUSH_SUBSCRIPTION_CHANGED
    )
}
