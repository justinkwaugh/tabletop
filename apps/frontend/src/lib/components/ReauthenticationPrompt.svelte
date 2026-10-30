<script lang="ts">
    import { Alert, Button, Label, P } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { untrack } from 'svelte'
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
    import {
        reauthentication,
        type PendingSensitiveAction
    } from '$lib/stores/reauthentication.svelte'

    let { action }: { action: PendingSensitiveAction } = $props()
    const initiatingAction = untrack(() => action)

    const { authorizationService, api } = getAppContext()
    const id = $props.id()

    let open = $derived(reauthentication.pending === initiatingAction)
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
        try {
            await reauthentication.complete(initiatingAction)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The confirmed action failed')
        }
    }

    function cancel() {
        password = ''
        failed = false
        reauthentication.cancel(initiatingAction)
    }

    async function resume() {
        try {
            await reauthentication.resume(initiatingAction)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The confirmed action failed')
        }
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
</script>

<AuthModal bind:open title="Confirm it's you" variant="form" oncancel={cancel}>
    {#if reauthentication.confirmed}
        <P class="mb-4 text-sm text-gray-600 dark:text-gray-300">
            Your identity is confirmed. Continue to {initiatingAction.description}.
        </P>
        <Button color="blue" type="button" onclick={resume}>Continue</Button>
        <Button color="light" type="button" onclick={cancel}>Cancel</Button>
    {:else}
        <P class="mb-4 text-sm text-gray-600 dark:text-gray-300">
            For your security, confirm it's you before you {initiatingAction.description}.
        </P>
        {#if failed}
            <Alert color="red" class="mb-4" role="alert">That password was not accepted.</Alert>
        {/if}
        <div class="flex flex-col gap-4">
            {#if canUsePassword}
                <form
                    class="flex flex-col gap-4"
                    onsubmit={submitPassword}
                    {@attach focusFirstInput}
                >
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
                <DiscordSignIn mode="reauthenticate" oncomplete={confirmed} />
            {/if}
            {#if !canUsePassword && !canUseGoogle && !canUseDiscord}
                <P class="text-sm text-gray-600 dark:text-gray-300">
                    This account has no password or linked account to confirm with. Use Forgot
                    password on the sign-in page to set one, then sign in again.
                </P>
                <Button color="light" href="/login/username" onclick={cancel}>Go to sign in</Button>
            {/if}
            <Button color="light" type="button" onclick={cancel}>Cancel</Button>
        </div>
    {/if}
</AuthModal>
