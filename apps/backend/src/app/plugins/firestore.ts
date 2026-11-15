import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { Firestore } from '@google-cloud/firestore'

declare module 'fastify' {
    interface FastifyInstance {
        firestore: Firestore
    }
}

export interface FirestorePluginOptions {
    projectId?: string
}

export default fp<FirestorePluginOptions>(async (fastify: FastifyInstance, opts) => {
    // Application Default Credentials, or FIRESTORE_EMULATOR_HOST when it is set.
    const firestore = new Firestore({
        projectId: opts.projectId || undefined,
        ignoreUndefinedProperties: true
    })
    fastify.decorate('firestore', firestore)
    fastify.addHook('onClose', async () => {
        try {
            await firestore.terminate()
        } catch (error) {
            fastify.log.warn({ err: error }, 'Failed to terminate the Firestore client')
        }
    })
})
