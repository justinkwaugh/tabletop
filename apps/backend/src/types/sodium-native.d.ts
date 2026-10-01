declare module 'sodium-native' {
    const sodium: {
        crypto_secretbox_KEYBYTES: number
        crypto_pwhash_SALTBYTES: number
        crypto_pwhash_OPSLIMIT_MODERATE: number
        crypto_pwhash_MEMLIMIT_MODERATE: number
        crypto_pwhash_ALG_DEFAULT: number
        crypto_pwhash_async(
            out: Buffer,
            passwd: Buffer,
            salt: Buffer,
            opslimit: number,
            memlimit: number,
            alg: number
        ): Promise<void>
    }
    export default sodium
}
