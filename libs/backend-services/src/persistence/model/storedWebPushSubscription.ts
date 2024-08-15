import { Type, type Static } from '@sinclair/typebox'
import { WebPushSubscription } from '../../notifications/subscriptions/webPushSubscription.js'
import { StoredSubscription } from './storedSubscription.js'

export type StoredWebPushSubscription = Static<typeof StoredWebPushSubscription>
export const StoredWebPushSubscription = Type.Composite([WebPushSubscription, StoredSubscription])
