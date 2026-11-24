<script lang="ts">
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
        [DiscordWebhookConnectResult.InvalidUrl]:
            "That isn't a Discord webhook URL. It starts with https://discord.com/api/webhooks/.",
        [DiscordWebhookConnectResult.NotFound]:
            'Discord has no webhook at that URL. It may have been deleted, or its URL reset.',
        [DiscordWebhookConnectResult.Unsupported]:
            "That webhook belongs to a Discord app and can't take these messages. Create a new one in the channel's Integrations settings.",
        [DiscordWebhookConnectResult.Failed]: "Discord didn't accept a message. Please try again."
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
            Each message mentions you, so Discord pings you even in a shared channel.
        {:else}
            Link your Discord account and each message will mention you, so Discord pings you even
            in a shared channel.
        {/if}
    </p>
{/snippet}

<div class="flex flex-col gap-3">
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">Discord Channel Webhook</h3>
    {#if webhook}
        <ConnectedNotificationChannel
            status={webhook.name
                ? `Posting to the Discord webhook ${webhook.name}.`
                : 'Posting to your Discord webhook.'}
            subject="the webhook"
            {disconnect}
        >
            {@render mentionNote()}
        </ConnectedNotificationChannel>
    {:else}
        {#if botOffered}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                For most players the Discord bot above is the better choice: it messages you
                directly and needs nothing set up on a server.
            </p>
        {/if}
        <p class="text-sm text-gray-700 dark:text-gray-300">
            If you'd rather have your notifications posted in a channel on a Discord server you
            manage, connect a webhook instead. In the channel's settings, open Integrations, then
            Webhooks, and create a webhook. Then copy its URL and paste it below.
        </p>
        {@render mentionNote()}
        <form class="flex flex-col gap-2" onsubmit={connect}>
            <Label for={`${id}-url`} class="sr-only">Webhook URL</Label>
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
                    Connect
                </Button>
            </div>
            {#if connectFailure}
                <p class="text-sm text-red-700 dark:text-red-400">{connectFailure}</p>
            {/if}
        </form>
    {/if}
</div>
