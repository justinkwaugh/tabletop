<script lang="ts">
    import { Card, A, Button, Hr, P } from 'flowbite-svelte'
    import GoogleSignIn, {
        isEnabled as isGoogleLoginEnabled
    } from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn, {
        isEnabled as isDiscordLoginEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { goto } from '$app/navigation'

    function gotoLocalLogin() {
        goto('/login/username')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center">
    <Card>
        <h1 class="text-5xl font-medium text-gray-900 dark:text-gray-300 mb-6">Welcome!</h1>
        {#if isGoogleLoginEnabled}
            <div class="mb-2"><GoogleSignIn mode={'login'} /></div>
        {/if}
        {#if isGoogleLoginEnabled}
            <div><DiscordSignIn mode={'login'} /></div>
        {/if}
        {#if isGoogleLoginEnabled || isDiscordLoginEnabled}
            <Hr classHr="my-8 w-64" classInnerDiv="dark:bg-gray-800 dark:text-gray-300">or</Hr>
        {/if}
        <Button color="blue" class="w-full mb-6" on:click={gotoLocalLogin} pill
            >Use Username / Password</Button
        >

        <P color="dark:text-gray-300"
            >Need an account?&nbsp;&nbsp;<A
                href="/signup"
                aClass="font-medium hover:none"
                color="dark:text-orange-300">Sign up</A
            ></P
        >
    </Card>
</div>
