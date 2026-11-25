<script lang="ts">
    import { m } from '$lib/paraglide/messages'
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
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">
        {m.telegram_heading()}
    </h3>
    {#if registration.connected}
        <ConnectedNotificationChannel
            status={m.telegram_connected()}
            disconnectFailedMessage={m.telegram_disconnect_failed()}
            {disconnect}
        >
            <p class="text-sm text-gray-700 dark:text-gray-300">
                {m.telegram_connected_detail()}
            </p>
        </ConnectedNotificationChannel>
    {:else}
        <p class="text-sm text-gray-700 dark:text-gray-300">
            {m.telegram_offer()}
        </p>
        <TelegramConnectLink />
    {/if}
</div>
