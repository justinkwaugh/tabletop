import { createRequire } from 'node:module'

const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const { Firestore } = require('@google-cloud/firestore')
const bcrypt = require('bcrypt')
const projectId = process.env.GCLOUD_PROJECT
if (!process.env.FIRESTORE_EMULATOR_HOST || !projectId?.startsWith('demo-')) {
    throw Error('An explicit demo- project and Firestore emulator are required')
}
const prefix = process.env.HOSTED_TEST_USER_PREFIX ?? 's20-'
const password = process.env.HOSTED_TEST_PASSWORD ?? 'local-18xx-verification'
const firestore = new Firestore({ projectId })
try {
    const passwordHash = await bcrypt.hash(password, 10)
    for (const name of ['alex', 'blair', 'casey', 'drew']) {
        const id = prefix + name
        const batch = firestore.batch()
        batch.set(firestore.collection('userUsernames').doc(id), {})
        batch.set(firestore.collection('userEmails').doc(`${id}@example.invalid`), {})
        batch.set(firestore.collection('users').doc(id), {
            id,
            username: id,
            cleanUsername: id,
            email: `${id}@example.invalid`,
            emailVerified: true,
            status: 'active',
            roles: ['user', 'betatester', 'alphatester'],
            externalIds: [],
            passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
        })
        await batch.commit()
    }
    console.log('Prepared four local 18xx verification accounts')
} finally {
    await firestore.terminate()
}
