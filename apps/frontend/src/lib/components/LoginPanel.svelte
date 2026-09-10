<script module lang="ts">
    import { isEnabled as isGoogleLoginEnabled } from '$lib/components/GoogleSignIn.svelte'
    import { isEnabled as isDiscordLoginEnabled } from '$lib/components/DiscordSignIn.svelte'

    export const hasSocialLogin = isGoogleLoginEnabled || isDiscordLoginEnabled
    export type LoginView = 'signin' | 'signup' | 'recovery'
    export const loginViewTitles: Record<LoginView, string> = {
        signin: 'Welcome!',
        signup: 'Create an account',
        recovery: 'Reset password'
    }
</script>

<script lang="ts">
    import { Button, Hr, P } from 'flowbite-svelte'
    import GoogleSignIn from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn from '$lib/components/DiscordSignIn.svelte'
    import UsernameLoginForm from '$lib/components/UsernameLoginForm.svelte'
    import ForgotPasswordForm from '$lib/components/ForgotPasswordForm.svelte'
    import SignupForm from '$lib/components/SignupForm.svelte'
    import AuthLink from '$lib/components/AuthLink.svelte'

    let { view = $bindable('signin') }: { view?: LoginView } = $props()
    let showUsernameLogin = $state(false)
</script>

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
    <div class="flex flex-col gap-3">
        {#if isGoogleLoginEnabled}
            <GoogleSignIn mode="login" />
        {/if}
        {#if isDiscordLoginEnabled}
            <DiscordSignIn mode="login" />
        {/if}
        <Hr class="my-4" innerDivClass="dark:bg-gray-800 dark:text-gray-300">or</Hr>
        <Button color="blue" class="w-full" onclick={() => (showUsernameLogin = true)} pill>
            Use Username / Password
        </Button>
        <P class="auth-secondary mt-3" color="dark:text-gray-300">
            Need an account? <AuthLink href="/signup" onactivate={() => (view = 'signup')}
                >Sign up</AuthLink
            >
        </P>
    </div>
{/if}
