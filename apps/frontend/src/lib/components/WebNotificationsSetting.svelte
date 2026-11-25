<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { onMount } from 'svelte'
    import { Button, Spinner } from 'flowbite-svelte'
    import { BellActiveSolid, CheckCircleSolid } from 'flowbite-svelte-icons'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import type { WebNotificationState } from '$lib/services/notificationService.svelte'

    type BrowserSetup = Exclude<WebNotificationState, 'granted'> | 'registering' | 'on' | 'failed'

    const { notificationService } = getAppContext()

    const initialState = notificationService.webNotificationState()
    let setup: BrowserSetup = $state(initialState === 'granted' ? 'registering' : initialState)

    async function turnOn() {
        setup = 'registering'
        try {
            const state = await notificationService.turnOnWebNotifications()
            setup = state === 'granted' ? 'on' : state
        } catch (error) {
            console.error('Failed to register this browser for notifications', error)
            setup = 'failed'
        }
    }

    onMount(() => {
        if (initialState === 'granted') void turnOn()
    })
</script>

{#if setup === 'on'}
    <p class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
        <CheckCircleSolid class="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
        {m.web_notifications_on()}
    </p>
    <p class="text-sm text-gray-700 dark:text-gray-300">
        {m.web_notifications_each_device()}
    </p>
{:else if setup === 'registering'}
    <p class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Spinner size="4" />
        {m.web_notifications_setting_up()}
    </p>
{:else if setup === 'default' || setup === 'failed'}
    {#if setup === 'failed'}
        <p class="text-sm font-medium text-gray-900 dark:text-white">
            {m.web_notifications_setup_failed()}
        </p>
    {/if}
    <p class="text-sm text-gray-700 dark:text-gray-300">
        {m.web_notifications_offer()}
    </p>
    <div class="flex justify-center py-1">
        <Button color="blue" onclick={turnOn}>
            <BellActiveSolid class="me-2 h-4 w-4" />
            {setup === 'failed' ? m.try_again() : m.web_notifications_turn_on()}
        </Button>
    </div>
{:else if setup === 'denied'}
    <p class="text-sm font-medium text-gray-900 dark:text-white">
        {m.web_notifications_blocked()}
    </p>
    <p class="text-sm text-gray-700 dark:text-gray-300">
        {m.web_notifications_blocked_help()}
    </p>
{:else}
    <p class="text-sm text-gray-700 dark:text-gray-300">
        {m.web_notifications_unsupported()}
    </p>
{/if}
