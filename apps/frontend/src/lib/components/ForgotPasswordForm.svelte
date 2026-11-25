<script lang="ts">
    import { Alert, Button, Input, Label } from 'flowbite-svelte'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import { challengeExpiryText } from '$lib/utils/challengeExpiry'
    import { getAppContext, trim } from '@tabletop/frontend-components'
    import { m } from '$lib/paraglide/messages'

    let { onback }: { onback: () => void } = $props()
    const { api } = getAppContext()
    const id = $props.id()
    let email = $state('')
    let sent = $state(false)
    let expiresAt: Date | undefined = $state(undefined)
    let submitting = $state(false)
    let failed = $state(false)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        submitting = true
        failed = false
        try {
            expiresAt = await api.sendPasswordResetEmail(email.trim())
            sent = true
        } catch {
            failed = true
        } finally {
            submitting = false
        }
    }
</script>

{#if sent}
    <div tabindex="-1" role="status" {@attach (node) => node.focus()}>
        <p class="font-medium text-lg mb-2">{m.auth_forgot_check_email()}</p>
        <p class="text-gray-600 dark:text-gray-300">
            {m.auth_forgot_link_sent()}
            {#if expiresAt}{challengeExpiryText(expiresAt)}{/if}
        </p>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-4 mt-8">
        <button
            class="auth-secondary text-sm text-gray-600 hover:underline dark:text-gray-300"
            onclick={onback}>{m.auth_back_to_sign_in()}</button
        >
        <button
            class="text-sm font-medium hover:underline dark:text-orange-300"
            onclick={() => (sent = false)}>{m.auth_forgot_try_another_email()}</button
        >
    </div>
{:else}
    <p class="text-gray-600 dark:text-gray-300 mb-5">
        {m.auth_forgot_intro()}
    </p>
    {#if failed}
        <Alert color="red" class="mb-4" role="alert">
            {m.auth_forgot_send_failed()}
        </Alert>
    {/if}
    <form class="flex flex-col gap-4" onsubmit={submit} {@attach focusFirstInput}>
        <div>
            <Label for={`${id}-email`} class="mb-2">{m.auth_email_address()}</Label>
            <Input
                class="auth-input"
                id={`${id}-email`}
                bind:value={email}
                oninput={trim}
                type="email"
                name="email"
                autocomplete="email"
                required
            />
        </div>
        <div class="flex items-center justify-between gap-4 mt-4">
            <button
                type="button"
                class="auth-secondary text-left text-sm text-gray-600 hover:underline dark:text-gray-300"
                onclick={onback}>{m.auth_back_to_sign_in()}</button
            >
            <Button
                color="blue"
                type="submit"
                class="shrink-0 whitespace-nowrap"
                disabled={submitting}
            >
                {submitting ? m.auth_forgot_sending() : m.auth_forgot_send_link()}
            </Button>
        </div>
    </form>
{/if}
