<script lang="ts">
    import { Button, P, Hr } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    let { oncancel }: { oncancel: () => void } = $props()
    let { notificationService } = getContext('appContext') as AppContext

    async function requestNotificationPermission() {
        dismiss()
        await notificationService.requestWebNotificationPermission()
    }

    async function dismiss() {
        oncancel()
    }
</script>

<h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">Allow notifications?</h1>
<Hr hrClass="mt-2 mb-4" />
<P class="dark:text-gray-300 mb-8"
    >You will only receive notifications about game invitations and to let you know it is your turn.</P
>
<div class="flex flex-row justify-center space-x-4">
    <Button onclick={() => dismiss()} color="light">Later</Button><Button
        onclick={() => requestNotificationPermission()}>Continue</Button
    >
</div>
