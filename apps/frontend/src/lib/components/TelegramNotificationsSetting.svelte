<script lang="ts">
    import { onMount } from 'svelte'
    import { Button, Hr, Spinner } from 'flowbite-svelte'
    import { CheckCircleSolid } from 'flowbite-svelte-icons'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { listenForNotificationChannelChanges } from '$lib/services/notificationChannelUpdates'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import TelegramConnectButton from '$lib/components/TelegramConnectButton.svelte'

    type Setup =
        | { kind: 'loading' }
        | { kind: 'unavailable' }
        | { kind: 'connected' }
        | { kind: 'disconnected'; link: string; fetchedAt: number }
        | { kind: 'failed' }

    const { api, notificationService } = getAppContext()
    // Links work for an hour; one older than this is replaced when the page is shown again.
    const LINK_REFRESH_MS = 30 * 60 * 1000
    const requests = new LatestRequest()
    let setup: Setup = $state({ kind: 'loading' })
    let disconnecting = $state(false)

    async function load() {
        const current = requests.begin()
        try {
            const status = await api.getTelegramNotificationStatus()
            let next: Setup
            if (!status.available) next = { kind: 'unavailable' }
            else if (status.connected) next = { kind: 'connected' }
            else
                next = {
                    kind: 'disconnected',
                    link: await api.createTelegramLink(),
                    fetchedAt: Date.now()
                }
            if (current()) setup = next
        } catch (error) {
            console.error('Could not load the Telegram notification setting', error)
            if (current()) setup = { kind: 'failed' }
        }
    }

    async function disconnect() {
        disconnecting = true
        try {
            await api.disconnectTelegram()
            await load()
        } catch (error) {
            console.error('Could not disconnect Telegram', error)
            setup = { kind: 'failed' }
        } finally {
            disconnecting = false
        }
    }

    function refreshStaleLink() {
        if (document.visibilityState !== 'visible' || setup.kind !== 'disconnected') return
        if (Date.now() - setup.fetchedAt > LINK_REFRESH_MS) void load()
    }

    onMount(() => {
        void load()
        const unsubscribe = listenForNotificationChannelChanges(notificationService, load)
        document.addEventListener('visibilitychange', refreshStaleLink)
        return () => {
            requests.cancel()
            unsubscribe()
            document.removeEventListener('visibilitychange', refreshStaleLink)
        }
    })
</script>

{#if setup.kind !== 'unavailable' && setup.kind !== 'loading'}
    <Hr class="my-6" />
    <div class="flex flex-col gap-3">
        <h3 class="text-xl font-medium text-gray-900 dark:text-white">Telegram Notifications</h3>
        {#if setup.kind === 'connected'}
            <p class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                <CheckCircleSolid class="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
                Telegram is connected.
            </p>
            <p class="text-sm text-gray-700 dark:text-gray-300">
                The Board Together bot messages you there when it's your turn or you're invited to a
                game. Sending /stop to the bot turns it off too.
            </p>
            <div class="flex justify-center py-1">
                <Button
                    class="h-[30px] w-[120px] rounded-full"
                    color="light"
                    size="xs"
                    disabled={disconnecting}
                    onclick={disconnect}
                >
                    {#if disconnecting}<Spinner size="4" class="me-2" />{/if}
                    Disconnect
                </Button>
            </div>
        {:else if setup.kind === 'disconnected'}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                Board Together has a Telegram bot that can message you when it's your turn. Press
                Connect, then press Start in Telegram.
            </p>
            <div class="flex justify-center py-1">
                <TelegramConnectButton href={setup.link} />
            </div>
        {:else}
            <p class="text-sm font-medium text-gray-900 dark:text-white">
                Board Together couldn't load your Telegram setting.
            </p>
            <div class="flex justify-center py-1">
                <Button color="blue" onclick={load}>Try again</Button>
            </div>
        {/if}
    </div>
{/if}
