import { FastifyRequest } from 'fastify'
import { verifyKey } from 'discord-interactions'

const CLIENT_PUBLIC_KEY = process.env['DISCORD_PUBLIC_KEY'] ?? ''

export async function hasValidDiscordSignature(request: FastifyRequest): Promise<boolean> {
    const signature = request.headers['x-signature-ed25519']
    const timestamp = request.headers['x-signature-timestamp']
    const rawBody = request.rawBody
    if (!rawBody || typeof signature !== 'string' || typeof timestamp !== 'string') {
        return false
    }
    return verifyKey(rawBody, signature, timestamp, CLIENT_PUBLIC_KEY)
}
