<script lang="ts">
    import { Alert, Button, Card, Input, Label, Modal } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { Role } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { confirmsUsername } from '$lib/utils/usernameConfirmation'
    import { broadcastLogout } from '$lib/utils/logoutChannel'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'
    import { m } from '$lib/paraglide/messages'
    import RichMessage from '$lib/components/RichMessage.svelte'

    const { authorizationService, api } = getAppContext()
    const confirmationId = $props.id()

    let open = $state(false)
    let typed = $state('')
    let deleting = $state(false)
    let failed = $state(false)

    let sessionUser = $derived(authorizationService.getSessionUser())
    let username = $derived(sessionUser?.username ?? '')
    let administrator = $derived(sessionUser?.roles.includes(Role.Admin) ?? false)
    let confirmed = $derived(confirmsUsername(typed, username))

    function start() {
        typed = ''
        failed = false
        open = true
    }

    async function confirmDeletion(event: SubmitEvent) {
        event.preventDefault()
        if (deleting) return
        failed = false
        await reauthentication.run({ purpose: 'delete-account', retry: remove })
    }

    async function remove() {
        deleting = true
        try {
            await api.deleteOwnAccount()
        } catch (error) {
            if (requiresRecentAuthentication(error)) throw error
            failed = true
            return
        } finally {
            deleting = false
        }
        open = false
        broadcastLogout()
        toast.success(m.delete_account_done())
        await authorizationService.onLogout()
    }
</script>

{#snippet emphasis(text: string)}<span class="font-semibold">{text}</span>{/snippet}

<Card class="bg-gray-300 p-4 sm:p-6">
    <div class="flex flex-col gap-3">
        <h3 class="text-xl font-medium text-gray-900 dark:text-white">
            {m.delete_account_heading()}
        </h3>
        <p class="text-sm text-gray-700 dark:text-gray-300">
            {m.delete_account_summary()}
        </p>
        {#if administrator}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                {m.delete_account_administrator()}
            </p>
        {:else}
            <div>
                <Button color="red" outline size="sm" onclick={start}
                    >{m.delete_account_start()}</Button
                >
            </div>
        {/if}
    </div>
</Card>

<Modal bind:open title={m.delete_account_confirm_title()} size="sm" autoclose={false} outsideclose>
    <form class="flex flex-col gap-4 text-sm" onsubmit={confirmDeletion}>
        <p class="text-gray-700 dark:text-gray-300">{m.delete_account_irreversible()}</p>
        <div>
            <p class="font-semibold text-gray-900 dark:text-gray-100">
                {m.delete_account_removed()}
            </p>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
                <li>{m.delete_account_removed_identity()}</li>
                <li>{m.delete_account_removed_settings()}</li>
                <li>{m.delete_account_removed_games()}</li>
                <li>{m.delete_account_removed_signups()}</li>
            </ul>
        </div>
        <div>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{m.delete_account_kept()}</p>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
                <li>{m.delete_account_kept_finished()}</li>
                <li>{m.delete_account_kept_in_progress()}</li>
                <li>{m.delete_account_kept_competitions()}</li>
            </ul>
        </div>
        <div>
            <Label for={confirmationId} class="mb-2">
                <RichMessage
                    parts={m.delete_account_type_username.parts({ username })}
                    markup={{ username: emphasis }}
                />
            </Label>
            <Input
                id={confirmationId}
                bind:value={typed}
                autocomplete="off"
                autocapitalize="off"
                spellcheck={false}
            />
        </div>
        {#if failed}
            <Alert color="red" class="dark:bg-red-200 dark:text-red-700" role="alert">
                {m.delete_account_failed()}
            </Alert>
        {/if}
        <div class="flex justify-end gap-2">
            <Button color="alternative" onclick={() => (open = false)}>{m.cancel()}</Button>
            <Button type="submit" color="red" disabled={!confirmed || deleting}>
                {deleting ? m.delete_account_deleting() : m.delete_account_confirm()}
            </Button>
        </div>
    </form>
</Modal>
