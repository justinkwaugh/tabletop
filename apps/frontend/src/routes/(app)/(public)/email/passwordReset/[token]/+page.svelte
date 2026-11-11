<script lang="ts">
    import { Label, Button, Alert, Helper } from 'flowbite-svelte'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import { goto } from '$app/navigation'
    import { getAppContext } from '@tabletop/frontend-components'
    import LandingPage from '$lib/components/LandingPage.svelte'
    import AuthModal from '$lib/components/AuthModal.svelte'
    import ForgotPasswordForm from '$lib/components/ForgotPasswordForm.svelte'

    const { api, authorizationService } = getAppContext()
    let { data } = $props()
    const id = $props.id()
    let open = $state(true)
    let password = $state('')
    let submitting = $state(false)
    let resetFailed = $state(false)
    let linkRejected = $state(false)
    let resetSuccess = $state(false)
    let passwordError = $state(false)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        passwordError = password.trim().length < 12
        if (passwordError) return
        submitting = true
        resetFailed = false
        try {
            await api.setPassword({ password: password.trim(), challenge: data.challenge })
            password = ''
            // Set Password ends every session of the Account, including one this browser held
            authorizationService.clearSessionUser()
            resetSuccess = true
        } catch (error) {
            if (error instanceof Error && error.name === 'InvalidChallengeError') {
                linkRejected = true
            } else {
                resetFailed = true
            }
        } finally {
            submitting = false
        }
    }

    function close() {
        goto(authorizationService.getSessionUser() ? '/dashboard' : '/')
    }
</script>

<svelte:head>
    <title>Reset password — Board Together</title>
</svelte:head>

<LandingPage />
<AuthModal
    bind:open
    title={resetSuccess ? 'Password reset' : 'Reset password'}
    label="Reset password"
    variant="form"
    oncancel={close}
>
    {#if linkRejected}
        <Alert color="red" class="mb-4" role="alert">
            This reset link has expired, was replaced by a newer one, or has already been used.
            Request a new one below.
        </Alert>
        <ForgotPasswordForm onback={() => goto('/login/username')} />
    {:else if resetSuccess}
        <p role="status" tabindex="-1" {@attach (node) => node.focus()}>
            Your password has been updated. Sign in with it to continue.
        </p>
        <div class="flex justify-end mt-8">
            <Button color="blue" onclick={() => goto('/login/username')}>Sign in</Button>
        </div>
    {:else}
        {#if resetFailed}
            <Alert color="red" class="mb-4" role="alert">
                We couldn’t update your password. Please try again.
            </Alert>
        {/if}
        <form class="flex flex-col gap-4" onsubmit={submit}>
            <div>
                <Label for={`${id}-password`} class="mb-2">New password</Label>
                <PasswordInput
                    id={`${id}-password`}
                    bind:value={password}
                    autocomplete="new-password"
                    describedby={`${id}-password-help`}
                    invalid={passwordError}
                    minlength={12}
                />
                <Helper
                    id={`${id}-password-help`}
                    class="mt-2"
                    color={passwordError ? 'red' : 'gray'}
                >
                    Use at least 12 characters.
                </Helper>
            </div>
            <div class="flex justify-end mt-4">
                <Button color="blue" type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Set new password'}
                </Button>
            </div>
        </form>
    {/if}
</AuthModal>
