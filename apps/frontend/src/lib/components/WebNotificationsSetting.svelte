<script lang="ts">
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
        Notifications are on for this device.
    </p>
    <p class="text-sm text-gray-700 dark:text-gray-300">
        Turn them on in each browser and on each device you want to hear from.
    </p>
{:else if setup === 'registering'}
    <p class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Spinner size="4" />
        Setting up notifications for this device…
    </p>
{:else if setup === 'default' || setup === 'failed'}
    {#if setup === 'failed'}
        <p class="text-sm font-medium text-gray-900 dark:text-white">
            Board Together couldn't set up notifications for this device.
        </p>
    {/if}
    <p class="text-sm text-gray-700 dark:text-gray-300">
        Board Together can tell you it's your turn through this browser, even when the site is
        closed. Turn them on in each browser and on each device you want to hear from.
    </p>
    <div class="flex justify-center py-1">
        <Button color="blue" onclick={turnOn}>
            <BellActiveSolid class="me-2 h-4 w-4" />
            {setup === 'failed' ? 'Try again' : 'Turn on notifications on this device'}
        </Button>
    </div>
{:else if setup === 'denied'}
    <p class="text-sm font-medium text-gray-900 dark:text-white">
        This browser is blocking notifications from Board Together.
    </p>
    <p class="text-sm text-gray-700 dark:text-gray-300">
        Allow notifications in this site's settings, usually behind the icon beside the address bar,
        then reload this page.
    </p>
{:else}
    <p class="text-sm text-gray-700 dark:text-gray-300">
        This browser can't show notifications. On an iPhone or iPad, add Board Together to your Home
        Screen from the Share menu, then open it from there and come back to this page.
    </p>
{/if}
