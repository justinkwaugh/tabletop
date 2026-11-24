export type DiscordWebhookConnection = {
    name: string
}

export enum DiscordWebhookConnectResult {
    Connected = 'connected',
    InvalidUrl = 'invalidUrl',
    NotFound = 'notFound',
    Unsupported = 'unsupported',
    Failed = 'failed'
}
