<script lang="ts">
    import { onMount } from 'svelte'
    import { Alert, Button, Helper, Input, Label, P } from 'flowbite-svelte'
    import type { PendingEmailChange } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { emailAddress } from '$lib/utils/accountFormValidation'
    import { challengeExpiryText } from '$lib/utils/challengeExpiry'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'

    const { api, authorizationService } = getAppContext()
    const ownerId = authorizationService.getSessionUser()?.id
    let user = $derived(authorizationService.getSessionUser())
    let email = $state(authorizationService.getSessionUser()?.email ?? '')
    let code = $state('')
    let pending = $state<PendingEmailChange>()
    let loading = $state(true)
    let busy = $state(false)
    let error = $state('')
    let changed = $state(false)

    onMount(() => {
        let mounted = true
        void api
            .pendingEmailChange()
            .then((value) => {
                if (mounted && user?.id === ownerId) pending = value
            })
            .catch(() => {
                if (mounted)
                    error =
                        'We could not load your pending email change. Please reload and try again.'
            })
            .finally(() => {
                if (mounted) loading = false
            })
        return () => {
            mounted = false
        }
    })

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (busy) return
        const result = emailAddress().safeParse(email)
        if (!result.success) {
            error = result.error.issues[0]?.message ?? 'Enter a valid email address.'
            return
        }
        await sendCode(result.data)
    }

    async function sendCode(address: string) {
        error = ''
        changed = false
        await reauthentication.run({
            description: 'change your email address',
            retry: async () => {
                busy = true
                try {
                    const requested = await api.requestEmailChange(address)
                    if (user?.id !== ownerId) return
                    pending = requested
                    code = ''
                } catch (failure) {
                    if (requiresRecentAuthentication(failure)) throw failure
                    error =
                        failure instanceof Error && failure.name === 'AlreadyExistsError'
                            ? 'That email address is already in use.'
                            : 'We could not send the code. Your current email address is unchanged. Please try again.'
                } finally {
                    busy = false
                }
            }
        })
    }

    async function confirm(event: SubmitEvent) {
        event.preventDefault()
        if (busy || !pending || !code.trim()) return
        const address = pending.email
        const submittedCode = code.trim()
        error = ''
        await reauthentication.run({
            description: 'confirm your new email address',
            retry: async () => {
                busy = true
                try {
                    const updated = await api.confirmEmailChange(address, submittedCode)
                    if (user?.id !== ownerId) return
                    authorizationService.setSessionUser(updated)
                    pending = undefined
                    email = updated.email ?? ''
                    code = ''
                    changed = true
                } catch (failure) {
                    if (requiresRecentAuthentication(failure)) throw failure
                    if (failure instanceof Error && failure.name === 'InvalidChallengeError') {
                        error =
                            'That code is incorrect or has expired. Use the latest code, or send a new one.'
                    } else if (failure instanceof Error && failure.name === 'AlreadyExistsError') {
                        error =
                            'That email address is now in use. Cancel and choose a different address.'
                    } else {
                        error =
                            'We could not confirm the change. Please reload to check your current email address before trying again.'
                    }
                } finally {
                    busy = false
                }
            }
        })
    }

    async function cancel() {
        busy = true
        error = ''
        try {
            await api.cancelEmailChange()
            pending = undefined
            code = ''
        } catch {
            error = 'We could not cancel the pending change. Please try again.'
        } finally {
            busy = false
        }
    }
</script>

<section
    class="mt-6 border-t border-gray-400 dark:border-gray-600 pt-6 space-y-4"
    aria-label="Email address"
>
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">Email address</h3>
    <P>Current verified address: <strong>{user?.email}</strong></P>
    {#if changed}
        <Alert color="green"
            >Your email address has been changed. Your other sessions have been signed out.</Alert
        >
    {/if}
    {#if error}<Alert color="red">{error}</Alert>{/if}
    {#if pending}
        <P
            >Enter the code sent to <strong>{pending.email}</strong>. Your current email stays
            active until you verify the new address.</P
        >
        <Helper>{challengeExpiryText(pending.expiresAt)}</Helper>
        <form class="space-y-4" onsubmit={confirm}>
            <Label for="email-change-code">Verification code</Label>
            <Input
                id="email-change-code"
                name="emailChangeCode"
                bind:value={code}
                autocomplete="one-time-code"
                required
            />
            <div class="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>Verify and change email</Button>
                <Button
                    type="button"
                    color="light"
                    disabled={busy}
                    onclick={() => {
                        if (pending) void sendCode(pending.email)
                    }}>Send new code</Button
                >
                <Button type="button" color="alternative" disabled={busy} onclick={cancel}
                    >Cancel email change</Button
                >
            </div>
        </form>
    {:else}
        <form class="space-y-4" onsubmit={submit}>
            <Label for="new-email">New email address</Label>
            <Input id="new-email" name="email" type="email" bind:value={email} required />
            <Helper
                >Your current email and account access stay unchanged until you verify the new
                address.</Helper
            >
            <Button
                type="submit"
                disabled={loading || busy || email.trim().toLowerCase() === user?.email}
                >Send verification code</Button
            >
        </form>
    {/if}
</section>
