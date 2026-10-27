<script lang="ts">
    import { Alert, Button, Label, P } from 'flowbite-svelte'
    import { ExternalAuthService } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import AuthModal from '$lib/components/AuthModal.svelte'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import GoogleSignIn, {
        isEnabled as isGoogleSigninEnabled
    } from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn, {
        isEnabled as isDiscordSigninEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import { reauthentication } from '$lib/stores/reauthentication.svelte'
    import type { DiscordAuthorizationResult } from '$lib/utils/discordAuthorization'

    const { authorizationService, api } = getAppContext()
    const id = $props.id()

    let open = $derived(reauthentication.pending !== undefined)
    let user = $derived(authorizationService.getSessionUser())
    let linkedProviders = $derived(
        new Set(user?.externalIds.map((externalId) => externalId.split(':', 2)[0]) ?? [])
    )
    let canUsePassword = $derived(Boolean(user?.hasPassword))
    let canUseGoogle = $derived(
        isGoogleSigninEnabled && linkedProviders.has(ExternalAuthService.Google)
    )
    let canUseDiscord = $derived(
        isDiscordSigninEnabled && linkedProviders.has(ExternalAuthService.Discord)
    )

    let password = $state('')
    let failed = $state(false)
    let submitting = $state(false)

    async function confirmed() {
        password = ''
        failed = false
        await reauthentication.complete()
    }

    function cancel() {
        password = ''
        failed = false
        reauthentication.cancel()
    }

    async function submitPassword(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        submitting = true
        failed = false
        try {
            await api.reauthenticateWithPassword(password.trim())
            await confirmed()
        } catch {
            failed = true
        } finally {
            submitting = false
        }
    }

    async function discordCompleted(result: DiscordAuthorizationResult) {
        if (result.outcome === 'success') {
            await confirmed()
        }
    }
</script>

<AuthModal bind:open title="Confirm it's you" variant="form" oncancel={cancel}>
    <P class="mb-4 text-sm text-gray-600 dark:text-gray-300">
        To {reauthentication.pending?.description ?? 'continue'}, sign in again first.
    </P>
    {#if failed}
        <Alert color="red" class="mb-4" role="alert">That password was not accepted.</Alert>
    {/if}
    <div class="flex flex-col gap-4">
        {#if canUsePassword}
            <form class="flex flex-col gap-4" onsubmit={submitPassword} {@attach focusFirstInput}>
                <div>
                    <Label for={`${id}-password`} class="mb-2">Password</Label>
                    <PasswordInput
                        id={`${id}-password`}
                        bind:value={password}
                        autocomplete="current-password"
                    />
                </div>
                <Button color="blue" type="submit" disabled={submitting}>
                    {submitting ? 'Confirming…' : 'Confirm'}
                </Button>
            </form>
        {/if}
        {#if canUseGoogle}
            <GoogleSignIn mode="reauthenticate" oncomplete={confirmed} />
        {/if}
        {#if canUseDiscord}
            <DiscordSignIn mode="reauthenticate" oncomplete={discordCompleted} />
        {/if}
        {#if !canUsePassword && !canUseGoogle && !canUseDiscord}
            <P class="text-sm text-gray-600 dark:text-gray-300">
                This account has no password or linked account to confirm with. Set a password from
                your profile first.
            </P>
        {/if}
        <Button color="light" type="button" onclick={cancel}>Cancel</Button>
    </div>
</AuthModal>
