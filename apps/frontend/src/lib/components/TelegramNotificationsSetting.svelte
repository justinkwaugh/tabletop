<script lang="ts">
    import type { BotRegistration } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import ConnectedNotificationChannel from '$lib/components/ConnectedNotificationChannel.svelte'
    import TelegramConnectLink from '$lib/components/TelegramConnectLink.svelte'

    let {
        registration,
        onchange
    }: { registration: BotRegistration; onchange: () => Promise<void> } = $props()

    const { api } = getAppContext()

    async function disconnect() {
        await api.disconnectTelegram()
        await onchange()
    }
</script>

<div class="flex flex-col gap-3">
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">Telegram Notifications</h3>
    {#if registration.connected}
        <ConnectedNotificationChannel
            status="Telegram is connected."
            subject="Telegram"
            {disconnect}
        >
            <p class="text-sm text-gray-700 dark:text-gray-300">
                The BoardTogether bot messages you there when it's your turn or you're invited to a
                game. Sending /stop to the bot turns it off too.
            </p>
        </ConnectedNotificationChannel>
    {:else}
        <p class="text-sm text-gray-700 dark:text-gray-300">
            BoardTogether has a Telegram bot that can message you when it's your turn. Press
            Connect, then press Start in Telegram.
        </p>
        <TelegramConnectLink />
    {/if}
</div>
