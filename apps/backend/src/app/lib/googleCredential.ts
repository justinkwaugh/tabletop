import { OAuth2Client, type TokenPayload } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] || ''

export async function verifyGoogleCredential(credential: string): Promise<TokenPayload> {
    const ticket = await new OAuth2Client().verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
    })
    const payload = ticket.getPayload()
    if (!payload) {
        throw Error('Invalid token')
    }
    return payload
}
