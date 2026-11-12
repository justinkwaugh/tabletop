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
        await reauthentication.run({ description: 'delete your account', retry: remove })
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
        toast.success('Your account has been deleted.')
        await authorizationService.onLogout()
    }
</script>

<Card class="bg-gray-300 p-4 sm:p-6">
    <div class="flex flex-col gap-3">
        <h3 class="text-xl font-medium text-gray-900 dark:text-white">Delete account</h3>
        <p class="text-sm text-gray-700 dark:text-gray-300">
            Permanently delete your account and everything tied to it. Finished games keep your
            moves under "Deleted player".
        </p>
        {#if administrator}
            <p class="text-sm text-gray-700 dark:text-gray-300">
                Administrator accounts can't be deleted.
            </p>
        {:else}
            <div>
                <Button color="red" outline size="sm" onclick={start}>Delete account…</Button>
            </div>
        {/if}
    </div>
</Card>

<Modal bind:open title="Delete your account?" size="sm" autoclose={false} outsideclose>
    <form class="flex flex-col gap-4 text-sm" onsubmit={confirmDeletion}>
        <p class="text-gray-700 dark:text-gray-300">This can't be undone.</p>
        <div>
            <p class="font-semibold text-gray-900 dark:text-gray-100">Removed</p>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
                <li>Your username, email, password and linked Google or Discord account</li>
                <li>Your preferences and notification settings; you're signed out everywhere</li>
                <li>Games you created that haven't started, and your seats in others</li>
                <li>Your sign-ups for league seasons that haven't started</li>
            </ul>
        </div>
        <div>
            <p class="font-semibold text-gray-900 dark:text-gray-100">Kept, without your name</p>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
                <li>
                    Finished games and your chat messages, shown as "Deleted player 1" and so on
                </li>
                <li>
                    Games in progress: the other players can end them, and most 2-player games end
                    as a win for your opponent
                </li>
                <li>
                    Tournaments you've entered and league seasons under way, which an administrator
                    finishes without you
                </li>
            </ul>
        </div>
        <div>
            <Label for={confirmationId} class="mb-2">
                Type your username, <span class="font-semibold">{username}</span>, to confirm
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
                We couldn't delete your account. Please try again.
            </Alert>
        {/if}
        <div class="flex justify-end gap-2">
            <Button color="alternative" onclick={() => (open = false)}>Cancel</Button>
            <Button type="submit" color="red" disabled={!confirmed || deleting}>
                {deleting ? 'Deleting…' : 'Delete my account'}
            </Button>
        </div>
    </form>
</Modal>
