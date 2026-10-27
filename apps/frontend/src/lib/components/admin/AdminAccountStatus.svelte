<script lang="ts">
    import {
        offeredAccountStatusTransition,
        type AccountStatusTransition,
        type User
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { accountStatusLabels } from '$lib/utils/accountStatus'

    let { user, onsaved }: { user: User; onsaved: (user: User) => void } = $props()

    const { api } = getAppContext()

    const transitions: Record<
        AccountStatusTransition,
        { action: string; pending: string; effect: string; done: string }
    > = {
        deactivate: {
            action: 'Deactivate account',
            pending: 'Deactivating…',
            effect: 'Deactivating signs the account out everywhere and refuses new sign-ins until it is reactivated.',
            done: 'Account deactivated. Existing sessions can no longer access the site.'
        },
        reactivate: {
            action: 'Reactivate account',
            pending: 'Reactivating…',
            effect: 'Reactivating lets the account sign in again. Sessions from before the deactivation stay signed out.',
            done: 'Account reactivated. Sessions from before the deactivation stay signed out.'
        }
    }

    type Outcome = { userId: string; kind: 'notice' | 'error'; text: string }

    let transition = $derived(offeredAccountStatusTransition(user.status))
    let pendingUserId = $state<string>()
    let saving = $derived(pendingUserId !== undefined)
    let outcome = $state<Outcome>()
    let shown = $derived(outcome?.userId === user.id ? outcome : undefined)

    async function apply(event: SubmitEvent) {
        event.preventDefault()
        if (!transition || saving) return
        const applied = transition
        const userId = user.id
        pendingUserId = userId
        outcome = undefined
        try {
            const updated = await api.transitionUserAccountStatus(userId, applied)
            outcome = { userId: updated.id, kind: 'notice', text: transitions[applied].done }
            onsaved(updated)
        } catch (failure) {
            outcome = {
                userId,
                kind: 'error',
                text:
                    failure instanceof Error
                        ? failure.message
                        : 'Could not change the account status'
            }
        } finally {
            pendingUserId = undefined
        }
    }
</script>

<form
    onsubmit={apply}
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Account status for ${user.username ?? user.id}`}
>
    <h2 class="text-base font-semibold">Account status</h2>
    <p class="mt-1 text-sm">
        Current status: <span class="font-medium">{accountStatusLabels[user.status]}</span>
    </p>
    {#if transition}
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {transitions[transition].effect}
        </p>
        <button
            type="submit"
            disabled={saving}
            aria-busy={pendingUserId === user.id}
            class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >{pendingUserId === user.id
                ? transitions[transition].pending
                : transitions[transition].action}</button
        >
    {:else}
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            A deleted account cannot be deactivated or reactivated.
        </p>
    {/if}
    {#if shown?.kind === 'error'}
        <p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">{shown.text}</p>
    {:else if shown?.kind === 'notice'}
        <p role="status" class="mt-3 text-sm text-green-700 dark:text-green-300">{shown.text}</p>
    {/if}
</form>
