<script lang="ts">
    import { Card, Label, A, Button, Hr, P, Input, Helper, Alert } from 'flowbite-svelte'
    import GoogleSignIn from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn from '$lib/components/DiscordSignIn.svelte'
    import { goto } from '$app/navigation'

    function gotoLocalLogin() {
        goto('/login/username')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center">
    <Card>
        <h1 class="text-5xl font-medium text-gray-900 dark:text-gray-300 mb-6">Welcome!</h1>
        <div class="mb-2"><GoogleSignIn mode={'login'} /></div>
        <div><DiscordSignIn mode={'login'} /></div>
        <Hr classHr="my-8 w-64" classInnerDiv="dark:bg-gray-800 dark:text-gray-300">or</Hr>
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
