<script lang="ts">
    import { Card, Input, Button, Alert } from 'flowbite-svelte'
    import { goto } from '$app/navigation'
    import { resolve } from '$app/paths'
    import { getAppContext } from '@tabletop/frontend-components'

    let { api } = getAppContext()
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
        goto(resolve('/login/username'))
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    <Card class="p-4 sm:p-6">
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">
            Enter your email address...
        </h1>
        {#if newEmailSent}
            <Alert class="dark:bg-green-200 dark:text-green-700 my-4">
                <span class="font-bold text-lg">Email Sent</span><br />
                If your email address is associated with a user in our system, an email with a password
                reset link was sent to it.
            </Alert>
        {/if}
        <form class="flex flex-col space-y-6 mt-4" action="/" onsubmit={sendForgotPasswordEmail}>
            <Input
                bind:value={email}
                oninput={trim}
                type="text"
                name="email"
                placeholder="name@company.com"
                required
            />
            <div class="flex flex-row justify-between">
                <Button color="light" onclick={gotoLogin}>Back to Login</Button><Button
                    type="submit">Submit</Button
                >
            </div>
        </form>
    </Card>
</div>
