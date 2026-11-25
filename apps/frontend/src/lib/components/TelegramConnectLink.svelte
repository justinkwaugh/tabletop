<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { onMount } from 'svelte'
    import { Button } from 'flowbite-svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import TelegramConnectButton from '$lib/components/TelegramConnectButton.svelte'

    type Link =
        { kind: 'loading' } | { kind: 'ready'; url: string; fetchedAt: number } | { kind: 'failed' }

    const { api } = getAppContext()
    // Links work for an hour; one older than this is replaced when the page is shown again.
    const LINK_REFRESH_MS = 30 * 60 * 1000
    const requests = new LatestRequest()
    let link = $state<Link>({ kind: 'loading' })

    async function fetchLink() {
        const isLatest = requests.begin()
        try {
            const url = await api.createTelegramLink()
            if (isLatest()) link = { kind: 'ready', url, fetchedAt: Date.now() }
        } catch (error) {
            console.error('Could not create a Telegram link', error)
            if (isLatest()) link = { kind: 'failed' }
        }
    }

    function refreshStaleLink() {
        if (document.visibilityState !== 'visible' || link.kind !== 'ready') return
        if (Date.now() - link.fetchedAt > LINK_REFRESH_MS) void fetchLink()
    }

    onMount(() => {
        void fetchLink()
        document.addEventListener('visibilitychange', refreshStaleLink)
        return () => {
            requests.cancel()
            document.removeEventListener('visibilitychange', refreshStaleLink)
        }
    })
</script>

{#if link.kind === 'ready'}
    <div class="flex justify-center py-1">
        <TelegramConnectButton href={link.url} />
    </div>
{:else if link.kind === 'failed'}
    <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-gray-900 dark:text-white">
            {m.telegram_link_failed()}
        </p>
        <Button color="blue" size="xs" onclick={fetchLink}>{m.try_again()}</Button>
    </div>
{/if}
