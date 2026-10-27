import { randomUUID } from 'node:crypto'
import { createClient, type RedisClientType } from 'redis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { RegistrationLimitExceededError } from '../../notifications/notificationErrors.js'
import { userTopic } from '../../notifications/topics.js'
import { TransportType } from '../../notifications/transports/notificationTransport.js'
import { WebPushTransport } from '../../notifications/transports/webPushTransport.js'
import { webPushClientData } from '../../notifications/tests/webPushFixtures.js'
import { FirestoreNotificationStore } from './notificationStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

const SPEC_REDIS_DATABASE = 15

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Firestore notification store registration limits',
    () => {
        let db: ReturnType<typeof isolatedFirestore>
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreNotificationStore
        let topic: string

        function webPush(token: string) {
            return WebPushTransport.webPushSubscriptionFromClientData(
                webPushClientData(`https://fcm.googleapis.com/fcm/send/${token}`)
            )
        }

        beforeEach(async () => {
            db = isolatedFirestore()
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false },
                database: SPEC_REDIS_DATABASE
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreNotificationStore(live.cache, db)
            topic = userTopic(randomUUID())
        })

        afterEach(async () => {
            live.cache.destroy()
            client.destroy()
            await db.terminate()
        })

        it('caps new registrations of one transport per topic without touching the others', async () => {
            const first = webPush('one')
            await store.upsertNotificationSubscription({
                subscription: first,
                topic,
                registrationLimit: 2
            })
            await store.upsertNotificationSubscription({
                subscription: webPush('two'),
                topic,
                registrationLimit: 2
            })
            await expect(
                store.upsertNotificationSubscription({
                    subscription: webPush('three'),
                    topic,
                    registrationLimit: 2
                })
            ).rejects.toBeInstanceOf(RegistrationLimitExceededError)

            await store.upsertNotificationSubscription({
                subscription: first,
                topic,
                registrationLimit: 2
            })
            await store.upsertNotificationSubscription({
                subscription: {
                    id: 'discord-user',
                    transport: TransportType.Discord,
                    discordUserId: 'discord-user'
                },
                topic,
                registrationLimit: 1
            })

            const registered = await store.findNotificationSubscriptions(topic)
            expect(registered.map((subscription) => subscription.id).sort()).toEqual(
                [first.id, webPush('two').id, 'discord-user'].sort()
            )
        })

        it('leaves registration unbounded when no limit is given', async () => {
            for (const token of ['a', 'b', 'c']) {
                await store.upsertNotificationSubscription({ subscription: webPush(token), topic })
            }
            expect(await store.findNotificationSubscriptions(topic)).toHaveLength(3)
        })
    }
)
