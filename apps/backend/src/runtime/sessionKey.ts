import sodium from 'sodium-native'

// @fastify/secure-session's salt when none is configured; the derivation below must match the
// plugin's own secret-based derivation so that existing session cookies stay readable.
const SECURE_SESSION_DEFAULT_SALT = Buffer.from('mq9hDxBVDbspDR6nLfFT1g==', 'base64')

export async function deriveSessionKey(secret: string, salt: string): Promise<string> {
    if (Buffer.byteLength(secret) < 32) throw new Error('Session secret must be at least 32 bytes')
    const saltBytes = salt ? Buffer.from(salt, 'ascii') : SECURE_SESSION_DEFAULT_SALT
    if (saltBytes.byteLength !== sodium.crypto_pwhash_SALTBYTES) {
        throw new Error(`Session salt must be ${sodium.crypto_pwhash_SALTBYTES} bytes`)
    }
    const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
    await sodium.crypto_pwhash_async(
        key,
        Buffer.from(secret),
        saltBytes,
        sodium.crypto_pwhash_OPSLIMIT_MODERATE,
        sodium.crypto_pwhash_MEMLIMIT_MODERATE,
        sodium.crypto_pwhash_ALG_DEFAULT
    )
    return key.toString('base64')
}
