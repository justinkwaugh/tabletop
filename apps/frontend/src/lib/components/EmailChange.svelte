<script lang="ts">
    import { onMount } from 'svelte'
    import { Alert, Button, Helper, Input, Label, P } from 'flowbite-svelte'
    import { normalizeEmailAddress, type PendingEmailChange } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { emailAddress } from '$lib/utils/accountFormValidation'
    import { challengeExpiryText } from '$lib/utils/challengeExpiry'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'
    import { m } from '$lib/paraglide/messages'
    import RichMessage from '$lib/components/RichMessage.svelte'

    const { api, authorizationService } = getAppContext()
    const formAccountId = authorizationService.getSessionUser()?.id
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
                if (mounted && user?.id === formAccountId) pending = value
            })
            .catch(() => {
                if (mounted) error = m.email_change_load_failed()
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
            error = result.error.issues[0]?.message ?? m.email_change_invalid_address()
            return
        }
        await sendCode(result.data)
    }

    async function sendCode(address: string) {
        error = ''
        changed = false
        await reauthentication.run({
            purpose: 'change-email',
            retry: async () => {
                busy = true
                try {
                    const requested = await api.requestEmailChange(address)
                    if (user?.id !== formAccountId) return
                    pending = requested
                    code = ''
                } catch (failure) {
                    if (requiresRecentAuthentication(failure)) throw failure
                    if (failure instanceof Error && failure.name === 'InvalidIDError') {
                        error = m.email_change_address_not_supported()
                    } else if (failure instanceof Error && failure.name === 'AlreadyExistsError') {
                        error = m.email_change_address_in_use()
                    } else {
                        error = m.email_change_send_failed()
                    }
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
            purpose: 'confirm-new-email',
            retry: async () => {
                busy = true
                try {
                    const updated = await api.confirmEmailChange(address, submittedCode)
                    if (user?.id !== formAccountId) return
                    authorizationService.setSessionUser(updated)
                    pending = undefined
                    email = updated.email ?? ''
                    code = ''
                    changed = true
                } catch (failure) {
                    if (requiresRecentAuthentication(failure)) throw failure
                    if (failure instanceof Error && failure.name === 'InvalidChallengeError') {
                        error = m.email_change_code_invalid()
                    } else if (failure instanceof Error && failure.name === 'AlreadyExistsError') {
                        error = m.email_change_address_now_in_use()
                    } else {
                        error = m.email_change_confirm_failed()
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
            error = m.email_change_cancel_failed()
        } finally {
            busy = false
        }
    }
</script>

{#snippet strong(text: string)}<strong>{text}</strong>{/snippet}

<section
    class="mt-6 border-t border-gray-400 dark:border-gray-600 pt-6 space-y-4"
    aria-label={m.email_change_heading()}
>
    <h3 class="text-xl font-medium text-gray-900 dark:text-white">{m.email_change_heading()}</h3>
    <P>{m.email_change_current_address()} <strong>{user?.email}</strong></P>
    {#if changed}
        <Alert color="green">{m.email_change_done()}</Alert>
    {/if}
    {#if error}<Alert color="red">{error}</Alert>{/if}
    {#if pending}
        <P>
            <RichMessage
                parts={m.email_change_enter_code.parts({ email: pending.email })}
                markup={{ address: strong }}
            />
        </P>
        <Helper>{challengeExpiryText(pending.expiresAt)}</Helper>
        <form class="space-y-4" onsubmit={confirm}>
            <Label for="email-change-code">{m.email_change_code_label()}</Label>
            <Input
                id="email-change-code"
                name="emailChangeCode"
                bind:value={code}
                autocomplete="one-time-code"
                required
            />
            <div class="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>{m.email_change_verify()}</Button>
                <Button
                    type="button"
                    color="light"
                    disabled={busy}
                    onclick={() => {
                        if (pending) void sendCode(pending.email)
                    }}>{m.email_change_send_new_code()}</Button
                >
                <Button type="button" color="alternative" disabled={busy} onclick={cancel}
                    >{m.email_change_cancel()}</Button
                >
            </div>
        </form>
    {:else}
        <form class="space-y-4" onsubmit={submit}>
            <Label for="new-email">{m.email_change_new_address()}</Label>
            <Input id="new-email" name="email" type="email" bind:value={email} required />
            <Helper>{m.email_change_unchanged_until_verified()}</Helper>
            <Button
                type="submit"
                disabled={loading || busy || normalizeEmailAddress(email) === user?.email}
                >{m.email_change_send_code()}</Button
            >
        </form>
    {/if}
</section>
