<script lang="ts">
    import { Label, Button, Input, Helper, Alert } from 'flowbite-svelte'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import AuthLink from '$lib/components/AuthLink.svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import { isAccountUnavailable } from '$lib/utils/accountErrors'
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
    let unavailableMessage = $state<string>()
    let submitting = $state(false)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        submitting = true
        loginFailed = false
        unavailableMessage = undefined

        try {
            const credentials: Credentials = {
                username: username.trim(),
                password: password.trim()
            }
            const user = await api.login(credentials)
            await authorizationService.onLogin(user)
        } catch (error) {
            if (isAccountUnavailable(error)) {
                unavailableMessage = error.message
            } else {
                loginFailed = true
            }
        } finally {
            submitting = false
        }
    }
</script>

{#snippet signupLink(text: string)}<AuthLink href="/signup" onactivate={onsignup}>{text}</AuthLink
    >{/snippet}

{#if unavailableMessage}
    <Alert color="red" class="mb-4" role="alert">{unavailableMessage}</Alert>
{/if}
{#if loginFailed}
    <Alert color="red" class="mb-4" role="alert">
        {m.auth_login_failed()}
    </Alert>
{/if}

<form class="flex flex-col gap-4" onsubmit={submit} {@attach focusFirstInput}>
    <div>
        <Label for={`${id}-username`} class="mb-2">{m.auth_username()}</Label>
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
        <Label for={`${id}-password`} class="mb-2">{m.auth_password()}</Label>
        <PasswordInput
            id={`${id}-password`}
            bind:value={password}
            autocomplete="current-password"
        />
    </div>
    <Helper class="text-right">
        <AuthLink href="/forgot/password" onactivate={onforgot}
            >{m.auth_login_forgot_password()}</AuthLink
        >
    </Helper>
    <div class="flex flex-wrap items-center justify-between gap-4 mt-2">
        {#if onback}
            <Button color="light" type="button" onclick={onback} disabled={submitting}
                >{m.auth_back()}</Button
            >
        {:else}
            <p class="auth-secondary text-sm text-gray-600 dark:text-gray-300">
                <RichMessage parts={m.auth_need_account.parts()} markup={{ signup: signupLink }} />
            </p>
        {/if}
        <Button color="blue" type="submit" disabled={submitting}>
            {submitting ? m.auth_signing_in() : m.auth_sign_in()}
        </Button>
    </div>
</form>
