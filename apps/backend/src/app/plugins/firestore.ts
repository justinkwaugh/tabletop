import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

declare module 'fastify' {
    interface FastifyInstance {
        firestore: Firestore
    }
}

export default fp(async (fastify: FastifyInstance) => {
    const firestore = getFirestore(fastify.firebase)
    firestore.settings({ ignoreUndefinedProperties: true })
    fastify.decorate('firestore', firestore)
})
