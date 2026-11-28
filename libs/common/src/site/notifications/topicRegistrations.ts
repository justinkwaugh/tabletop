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

export type AdminTopicRegistrations = {
    webPushBrowsers: string[]
    discordBot: boolean
    telegram: boolean
    discordWebhook?: DiscordWebhookConnection
}
