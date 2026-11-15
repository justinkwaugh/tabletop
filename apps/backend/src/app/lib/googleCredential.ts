import {
    OAuth2Client,
    type LoginTicket,
    type TokenPayload,
    type VerifyIdTokenOptions
} from 'google-auth-library'
import { concealedCause } from '@tabletop/backend-services'

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] || ''

export interface GoogleCredentialVerifier {
    verifyIdToken(options: VerifyIdTokenOptions): Promise<LoginTicket>
}

export class GoogleAuthorizationFailedError extends Error {
    readonly statusCode = 401

    constructor(cause?: Error) {
        super('Google did not confirm the credential', { cause })
        this.name = 'GoogleAuthorizationFailedError'
    }
}

// The verifier quotes the credential in its failure messages, so a failure is reported through a
// copy that carries only the credential's reference.
export async function verifyGoogleCredential(
    credential: string,
    verifier: GoogleCredentialVerifier = new OAuth2Client()
): Promise<TokenPayload> {
    let ticket: LoginTicket
    try {
        ticket = await verifier.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
    } catch (error) {
        throw new GoogleAuthorizationFailedError(concealedCause(error, [credential]))
    }
    const payload = ticket.getPayload()
    if (!payload) {
        throw new GoogleAuthorizationFailedError()
    }
    return payload
}
