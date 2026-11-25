<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import type { Snippet } from 'svelte'
    import { Button, Spinner } from 'flowbite-svelte'
    import { CheckCircleSolid } from 'flowbite-svelte-icons'

    let {
        status,
        disconnectFailedMessage,
        disconnect,
        children
    }: {
        status: string
        disconnectFailedMessage: string
        disconnect: () => Promise<void>
        children?: Snippet
    } = $props()

    let disconnecting = $state(false)
    let disconnectFailed = $state(false)

    async function pressDisconnect() {
        disconnecting = true
        disconnectFailed = false
        try {
            await disconnect()
        } catch (error) {
            console.error('Could not disconnect a notification channel', error)
            disconnectFailed = true
        } finally {
            disconnecting = false
        }
    }
</script>

<p class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
    <CheckCircleSolid class="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
    {status}
</p>
{@render children?.()}
<div class="flex justify-center py-1">
    <Button
        class="h-[30px] w-[120px] rounded-full"
        color="light"
        size="xs"
        disabled={disconnecting}
        onclick={pressDisconnect}
    >
        {#if disconnecting}<Spinner size="4" class="me-2" />{/if}
        {m.notification_channel_disconnect()}
    </Button>
</div>
{#if disconnectFailed}
    <p class="text-sm text-red-700 dark:text-red-400">
        {disconnectFailedMessage}
    </p>
{/if}
