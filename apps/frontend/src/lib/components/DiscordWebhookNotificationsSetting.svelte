<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { Button, Input, Label, Spinner } from 'flowbite-svelte'
    import { DiscordWebhookConnectResult, type DiscordWebhookConnection } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import ConnectedNotificationChannel from '$lib/components/ConnectedNotificationChannel.svelte'

    let {
        webhook,
        discordLinked,
        botOffered,
        onchange
    }: {
        webhook: DiscordWebhookConnection | undefined
        discordLinked: boolean
        botOffered: boolean
        onchange: () => Promise<void>
    } = $props()

    const CONNECT_FAILURES: Record<
        Exclude<DiscordWebhookConnectResult, DiscordWebhookConnectResult.Connected>,
        string
    > = {
        [DiscordWebhookConnectResult.InvalidUrl]: m.discord_webhook_invalid_url(),
        [DiscordWebhookConnectResult.NotFound]: m.discord_webhook_not_found(),
        [DiscordWebhookConnectResult.Unsupported]: m.discord_webhook_unsupported(),
        [DiscordWebhookConnectResult.Failed]: m.discord_webhook_failed()
    }

    const { api } = getAppContext()
    const id = $props.id()
    let url = $state('')
    let connecting = $state(false)
    let connectFailure: string | undefined = $state()

    async function connect(event: SubmitEvent) {
        event.preventDefault()
        connecting = true
        connectFailure = undefined
        try {
            const result = await api.connectDiscordWebhook(url)
            if (result === DiscordWebhookConnectResult.Connected) {
                url = ''
                await onchange()
            } else {
                connectFailure = CONNECT_FAILURES[result]
            }
        } catch (error) {
            console.error('Could not connect a Discord webhook', error)
            connectFailure = CONNECT_FAILURES[DiscordWebhookConnectResult.Failed]
        } finally {
            connecting = false
        }
    }

    async function disconnect() {
        await api.disconnectDiscordWebhook()
        await onchange()
    }
</script>

{#snippet mentionNote()}
    <p class="text-sm text-gray-700 dark:text-gray-300">
        {#if discordLinked}
            {m.discord_webhook_mentions_you()}
        {:else}
            {m.discord_webhook_link_to_mention()}
        {/if}
    </p>
{/snippet}

<div class="flex flex-col gap-3">
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">
        {m.discord_webhook_heading()}
    </h3>
    {#if webhook}
        <ConnectedNotificationChannel
            status={webhook.name
                ? m.discord_webhook_posting_named({ name: webhook.name })
                : m.discord_webhook_posting()}
            disconnectFailedMessage={m.discord_webhook_disconnect_failed()}
            {disconnect}
        >
            {@render mentionNote()}
        </ConnectedNotificationChannel>
    {:else}
        {#if botOffered}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                {m.discord_webhook_prefer_bot()}
            </p>
        {/if}
        <p class="text-sm text-gray-700 dark:text-gray-300">
            {m.discord_webhook_instructions()}
        </p>
        {@render mentionNote()}
        <form class="flex flex-col gap-2" onsubmit={connect}>
            <Label for={`${id}-url`} class="sr-only">{m.discord_webhook_url_label()}</Label>
            <div class="flex gap-2">
                <Input
                    id={`${id}-url`}
                    bind:value={url}
                    type="url"
                    placeholder="https://discord.com/api/webhooks/…"
                    autocomplete="off"
                    required
                />
                <Button color="blue" type="submit" class="shrink-0" disabled={connecting}>
                    {#if connecting}<Spinner size="4" class="me-2" />{/if}
                    {m.discord_webhook_connect()}
                </Button>
            </div>
            {#if connectFailure}
                <p class="text-sm text-red-700 dark:text-red-400">{connectFailure}</p>
            {/if}
        </form>
    {/if}
</div>
