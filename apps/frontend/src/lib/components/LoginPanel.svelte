<script module lang="ts">
    import { isEnabled as isGoogleLoginEnabled } from '$lib/components/GoogleSignIn.svelte'
    import { isEnabled as isDiscordLoginEnabled } from '$lib/components/DiscordSignIn.svelte'
    import { m } from '$lib/paraglide/messages'

    export const hasSocialLogin = isGoogleLoginEnabled || isDiscordLoginEnabled
    export type LoginView = 'signin' | 'signup' | 'recovery'
    export const loginViewTitles: Record<LoginView, () => string> = {
        signin: m.auth_title_welcome,
        signup: m.auth_title_create_account,
        recovery: m.auth_title_reset_password
    }
</script>

<script lang="ts">
    import { Button, P } from 'flowbite-svelte'
    import GoogleSignIn from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn from '$lib/components/DiscordSignIn.svelte'
    import UsernameLoginForm from '$lib/components/UsernameLoginForm.svelte'
    import ForgotPasswordForm from '$lib/components/ForgotPasswordForm.svelte'
    import SignupForm from '$lib/components/SignupForm.svelte'
    import AuthLink from '$lib/components/AuthLink.svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'

    let { view = $bindable('signin') }: { view?: LoginView } = $props()
    let showUsernameLogin = $state(false)
</script>

{#snippet signupLink(text: string)}<AuthLink href="/signup" onactivate={() => (view = 'signup')}
        >{text}</AuthLink
    >{/snippet}

{#if view === 'signup'}
    <SignupForm onsignin={() => (view = 'signin')} />
{:else if view === 'recovery'}
    <ForgotPasswordForm onback={() => (view = 'signin')} />
{:else if showUsernameLogin || !hasSocialLogin}
    <UsernameLoginForm
        onback={hasSocialLogin ? () => (showUsernameLogin = false) : undefined}
        onforgot={() => (view = 'recovery')}
        onsignup={() => (view = 'signup')}
    />
{:else}
    <div class="mx-auto flex w-full max-w-[400px] flex-col gap-3">
        {#if isGoogleLoginEnabled}
            <GoogleSignIn mode="login" />
        {/if}
        {#if isDiscordLoginEnabled}
            <DiscordSignIn mode="login" />
        {/if}
        <div class="my-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
            <span>{m.auth_login_or()}</span>
            <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
        </div>
        <Button color="blue" class="w-full" onclick={() => (showUsernameLogin = true)} pill>
            {m.auth_login_use_username()}
        </Button>
        <P class="auth-secondary mt-3" color="dark:text-gray-300">
            <RichMessage parts={m.auth_need_account.parts()} markup={{ signup: signupLink }} />
        </P>
    </div>
{/if}
