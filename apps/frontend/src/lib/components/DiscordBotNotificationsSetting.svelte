<script lang="ts">
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
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">Discord Notifications</h3>
    {#if registration.connected}
        <ConnectedNotificationChannel
            status="The Discord bot is connected."
            subject="the Discord bot"
            {disconnect}
        >
            <p class="text-sm text-gray-700 dark:text-gray-300">
                The BoardTogether bot sends you direct messages when it's your turn or you're
                invited to a game. Sending /stop to the bot turns it off too, and /notify turns it
                back on.
            </p>
        </ConnectedNotificationChannel>
    {:else}
        <p class="text-sm text-gray-700 dark:text-gray-300">
            BoardTogether has a Discord bot that can send you direct messages, whichever servers you
            are in.
        </p>
        {#if discordLinked}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                Add the bot to your Discord account and it will start sending you notifications
                right away. If you added it before linking your account, send it /notify.
            </p>
            <div class="flex justify-center py-1">
                <DiscordSignIn mode="bot" />
            </div>
        {:else}
            <p class="text-sm text-gray-700 dark:text-gray-300">First link your Discord account.</p>
            <div class="flex justify-center py-1">
                <DiscordSignIn mode="link" />
            </div>
        {/if}
    {/if}
</div>
