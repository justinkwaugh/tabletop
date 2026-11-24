import type { DiscordWebhookConnection } from './discordWebhook.js'

export type BotRegistration = {
    available: boolean
    connected: boolean
}

export type UserTopicRegistrations = {
    discordBot: BotRegistration
    telegram: BotRegistration
    discordWebhook?: DiscordWebhookConnection
}
