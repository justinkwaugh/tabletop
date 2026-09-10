<script lang="ts">
    import { Label, Button, Input, Helper, Alert } from 'flowbite-svelte'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import AuthLink from '$lib/components/AuthLink.svelte'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import { getAppContext, trim, type Credentials } from '@tabletop/frontend-components'

    let {
        onback,
        onforgot,
        onsignup
    }: {
        onback?: () => void
        onforgot?: () => void
        onsignup?: () => void
    } = $props()
    const { authorizationService, api } = getAppContext()
    const id = $props.id()

    let username = $state('')
    let password = $state('')
    let loginFailed = $state(false)
    let submitting = $state(false)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        submitting = true
        loginFailed = false

        try {
            const credentials: Credentials = {
                username: username.trim(),
                password: password.trim()
            }
            const user = await api.login(credentials)
            await authorizationService.onLogin(user)
        } catch {
            loginFailed = true
        } finally {
            submitting = false
        }
    }
</script>

{#if loginFailed}
    <Alert color="red" class="mb-4" role="alert">
        Unable to sign in. Please check your username and password and try again.
    </Alert>
{/if}

<form class="flex flex-col gap-4" onsubmit={submit} {@attach focusFirstInput}>
    <div>
        <Label for={`${id}-username`} class="mb-2">Username</Label>
        <Input
            class="auth-input"
            id={`${id}-username`}
            bind:value={username}
            oninput={trim}
            name="username"
            autocomplete="username"
            required
        />
    </div>
    <div>
        <Label for={`${id}-password`} class="mb-2">Password</Label>
        <PasswordInput
            id={`${id}-password`}
            bind:value={password}
            autocomplete="current-password"
        />
    </div>
    <Helper class="text-right">
        <AuthLink href="/forgot/password" onactivate={onforgot}>Forgot password?</AuthLink>
    </Helper>
    <div class="flex flex-wrap items-center justify-between gap-4 mt-2">
        {#if onback}
            <Button color="light" type="button" onclick={onback} disabled={submitting}>Back</Button>
        {:else}
            <p class="auth-secondary text-sm text-gray-600 dark:text-gray-300">
                Need an account? <AuthLink href="/signup" onactivate={onsignup}>Sign up</AuthLink>
            </p>
        {/if}
        <Button color="blue" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
    </div>
</form>
