<script lang="ts">
    import { Alert, Button, Input, Label } from 'flowbite-svelte'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import { getAppContext, trim } from '@tabletop/frontend-components'

    let { onback }: { onback: () => void } = $props()
    const { api } = getAppContext()
    const id = $props.id()
    let email = $state('')
    let sent = $state(false)
    let submitting = $state(false)
    let failed = $state(false)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        submitting = true
        failed = false
        try {
            await api.sendPasswordResetEmail(email.trim())
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
        <p class="font-medium text-lg mb-2">Check your email</p>
        <p class="text-gray-600 dark:text-gray-300">
            If that email is associated with an account, we’ve sent a password reset link.
        </p>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-4 mt-8">
        <button
            class="auth-secondary text-sm text-gray-600 hover:underline dark:text-gray-300"
            onclick={onback}>Back to sign in</button
        >
        <button
            class="text-sm font-medium hover:underline dark:text-orange-300"
            onclick={() => (sent = false)}>Try another email</button
        >
    </div>
{:else}
    <p class="text-gray-600 dark:text-gray-300 mb-5">
        We’ll email you a link to reset your password.
    </p>
    {#if failed}
        <Alert color="red" class="mb-4" role="alert">
            We couldn’t send the reset email. Please try again.
        </Alert>
    {/if}
    <form class="flex flex-col gap-4" onsubmit={submit} {@attach focusFirstInput}>
        <div>
            <Label for={`${id}-email`} class="mb-2">Email address</Label>
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
                onclick={onback}>Back to sign in</button
            >
            <Button
                color="blue"
                type="submit"
                class="shrink-0 whitespace-nowrap"
                disabled={submitting}
            >
                {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
        </div>
    </form>
{/if}
