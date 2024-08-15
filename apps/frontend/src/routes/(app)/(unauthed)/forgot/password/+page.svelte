<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert, P, Hr } from 'flowbite-svelte'
    import { goto } from '$app/navigation'
    import { type AppContext } from '@tabletop/frontend-components'
    import { getContext } from 'svelte'

    let { api } = getContext('appContext') as AppContext
    let email: string | undefined = $state(undefined)
    let newEmailSent = $state(false)

    async function sendForgotPasswordEmail(event: SubmitEvent) {
        event.preventDefault()
        if (!email) {
            return
        }
        await api.sendPasswordResetEmail(email)
        email = undefined
        newEmailSent = true
    }

    function trim(event: Event) {
        const input = event.target as HTMLInputElement
        input.value = input.value.trim()
    }

    function gotoLogin() {
        goto('/login/username')
    }
</script>

<div class="h-screen flex flex-col items-center justify-center space-y-6">
    <Card>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">
            Enter your email address...
        </h1>
        {#if newEmailSent}
            <Alert color="none" class="dark:bg-green-200 dark:text-green-700 my-4">
                <span class="font-bold text-lg">Email Sent</span><br />
                If your email address is associated with a user in our system, an email with a password
                reset link was sent to it.
            </Alert>
        {/if}
        <form class="flex flex-col space-y-6 mt-4" action="/" onsubmit={sendForgotPasswordEmail}>
            <Label class="space-y-2">
                <Input
                    bind:value={email}
                    on:input={trim}
                    type="text"
                    name="email"
                    placeholder="name@company.com"
                    required
                />
            </Label>
            <div class="flex flex-row justify-between">
                <Button color="light" on:click={gotoLogin}>Back to Login</Button><Button
                    type="submit">Submit</Button
                >
            </div>
        </form>
    </Card>
</div>
