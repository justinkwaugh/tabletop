<script lang="ts">
    import { Alert, Button, Label, P } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { untrack } from 'svelte'
    import { ExternalAuthService, externalIdentityProvider } from '@tabletop/common'
    import { APIError, getAppContext } from '@tabletop/frontend-components'
    import AuthModal from '$lib/components/AuthModal.svelte'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import GoogleSignIn, {
        isEnabled as isGoogleSigninEnabled
    } from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn, {
        isEnabled as isDiscordSigninEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import {
        reauthentication,
        type PendingSensitiveAction,
        type SensitiveActionPurpose
    } from '$lib/stores/reauthentication.svelte'
    import { m } from '$lib/paraglide/messages'

    let { action }: { action: PendingSensitiveAction } = $props()
    const initiatingAction = untrack(() => action)

    const explanations: Record<
        SensitiveActionPurpose,
        { request: () => string; confirmed: () => string }
    > = {
        'change-password': {
            request: m.auth_reauth_request_change_password,
            confirmed: m.auth_reauth_confirmed_change_password
        },
        'update-profile': {
            request: m.auth_reauth_request_update_profile,
            confirmed: m.auth_reauth_confirmed_update_profile
        },
        'change-email': {
            request: m.auth_reauth_request_change_email,
            confirmed: m.auth_reauth_confirmed_change_email
        },
        'confirm-new-email': {
            request: m.auth_reauth_request_confirm_new_email,
            confirmed: m.auth_reauth_confirmed_confirm_new_email
        },
        'delete-account': {
            request: m.auth_reauth_request_delete_account,
            confirmed: m.auth_reauth_confirmed_delete_account
        },
        'update-email': {
            request: m.auth_reauth_request_update_email,
            confirmed: m.auth_reauth_confirmed_update_email
        },
        'complete-profile': {
            request: m.auth_reauth_request_complete_profile,
            confirmed: m.auth_reauth_confirmed_complete_profile
        },
        'link-discord': {
            request: m.auth_reauth_request_link_discord,
            confirmed: m.auth_reauth_confirmed_link_discord
        },
        'link-google': {
            request: m.auth_reauth_request_link_google,
            confirmed: m.auth_reauth_confirmed_link_google
        }
    }
    const explanation = explanations[initiatingAction.purpose]

    const { authorizationService, api } = getAppContext()
    const id = $props.id()

    let open = $derived(reauthentication.pending === initiatingAction)
    let user = $derived(authorizationService.getSessionUser())
    let linkedProviders = $derived(new Set(user?.externalIds.map(externalIdentityProvider) ?? []))
    let canUsePassword = $derived(Boolean(user?.hasPassword))
    let canUseGoogle = $derived(
        isGoogleSigninEnabled && linkedProviders.has(ExternalAuthService.Google)
    )
    let canUseDiscord = $derived(
        isDiscordSigninEnabled && linkedProviders.has(ExternalAuthService.Discord)
    )

    let password = $state('')
    let failure: string | undefined = $state(undefined)
    let submitting = $state(false)

    async function confirmed() {
        password = ''
        failure = undefined
        try {
            await reauthentication.complete(initiatingAction)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : m.auth_reauth_action_failed())
        }
    }

    function cancel() {
        password = ''
        failure = undefined
        reauthentication.cancel(initiatingAction)
    }

    async function resume() {
        try {
            await reauthentication.resume(initiatingAction)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : m.auth_reauth_action_failed())
        }
    }

    async function submitPassword(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        submitting = true
        failure = undefined
        try {
            await api.reauthenticateWithPassword(password.trim())
            await confirmed()
        } catch (error) {
            if (error instanceof APIError && error.name === 'ReauthenticationFailedError') {
                failure = m.auth_reauth_password_rejected()
            } else if (
                error instanceof APIError &&
                error.name === 'ReauthenticationRateLimitError'
            ) {
                failure = error.message
            } else {
                failure = m.auth_reauth_failed()
            }
        } finally {
            submitting = false
        }
    }
</script>

<AuthModal bind:open title={m.auth_reauth_title()} variant="form" oncancel={cancel}>
    {#if reauthentication.confirmed}
        <P class="mb-4 text-sm text-gray-600 dark:text-gray-300">
            {explanation.confirmed()}
        </P>
        <Button color="blue" type="button" onclick={resume}>{m.auth_continue()}</Button>
        <Button color="light" type="button" onclick={cancel}>{m.cancel()}</Button>
    {:else}
        <P class="mb-4 text-sm text-gray-600 dark:text-gray-300">
            {explanation.request()}
        </P>
        {#if failure}
            <Alert color="red" class="mb-4" role="alert">{failure}</Alert>
        {/if}
        <div class="flex flex-col gap-4">
            {#if canUsePassword}
                <form
                    class="flex flex-col gap-4"
                    onsubmit={submitPassword}
                    {@attach focusFirstInput}
                >
                    <div>
                        <Label for={`${id}-password`} class="mb-2">{m.auth_password()}</Label>
                        <PasswordInput
                            id={`${id}-password`}
                            bind:value={password}
                            autocomplete="current-password"
                        />
                    </div>
                    <Button color="blue" type="submit" disabled={submitting}>
                        {submitting ? m.auth_reauth_confirming() : m.auth_reauth_confirm()}
                    </Button>
                </form>
            {/if}
            {#if canUseGoogle}
                <GoogleSignIn mode="reauthenticate" oncomplete={confirmed} />
            {/if}
            {#if canUseDiscord}
                <DiscordSignIn mode="reauthenticate" oncomplete={confirmed} />
            {/if}
            {#if !canUsePassword && !canUseGoogle && !canUseDiscord}
                <P class="text-sm text-gray-600 dark:text-gray-300">
                    {m.auth_reauth_no_method()}
                </P>
                <Button color="light" href="/login/username" onclick={cancel}
                    >{m.auth_reauth_go_to_sign_in()}</Button
                >
            {/if}
            <Button color="light" type="button" onclick={cancel}>{m.cancel()}</Button>
        </div>
    {/if}
</AuthModal>
