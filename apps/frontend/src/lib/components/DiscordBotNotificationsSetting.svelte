<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import type { BotRegistration } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import ConnectedNotificationChannel from '$lib/components/ConnectedNotificationChannel.svelte'
    import DiscordSignIn from '$lib/components/DiscordSignIn.svelte'

    let {
        registration,
        discordLinked,
        onchange
    }: {
        registration: BotRegistration
        discordLinked: boolean
        onchange: () => Promise<void>
    } = $props()

    const { api } = getAppContext()

    async function disconnect() {
        await api.disconnectDiscordBot()
        await onchange()
    }
</script>

<div class="flex flex-col gap-3">
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">
        {m.discord_bot_heading()}
    </h3>
    {#if registration.connected}
        <ConnectedNotificationChannel
            status={m.discord_bot_connected()}
            disconnectFailedMessage={m.discord_bot_disconnect_failed()}
            {disconnect}
        >
            <p class="text-sm text-gray-700 dark:text-gray-300">
                {m.discord_bot_connected_detail()}
            </p>
        </ConnectedNotificationChannel>
    {:else}
        <p class="text-sm text-gray-700 dark:text-gray-300">
            {m.discord_bot_offer()}
        </p>
        {#if discordLinked}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                {m.discord_bot_add()}
            </p>
            <div class="flex justify-center py-1">
                <DiscordSignIn mode="bot" />
            </div>
        {:else}
            <p class="text-sm text-gray-700 dark:text-gray-300">{m.discord_bot_link_first()}</p>
            <div class="flex justify-center py-1">
                <DiscordSignIn mode="link" />
            </div>
        {/if}
    {/if}
</div>
