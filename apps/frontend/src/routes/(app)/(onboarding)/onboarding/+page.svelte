<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert, P, Hr } from 'flowbite-svelte'
    import { goto } from '$app/navigation'
    import { TabletopApi } from '@tabletop/frontend-components'
    import { UserStatus } from '@tabletop/common'
    import { getContext } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    let { authorizationService, api } = getContext('appContext') as AppContext

    let username: string | undefined = $state(undefined)
    let email: string | undefined = $state(undefined)
    let verificationToken: string | undefined = $state(undefined)
    let verificationError = $state(false)
    let newEmailSent = $state(false)

    let user = $derived(authorizationService.getSessionUser())

    async function updateUser(event: SubmitEvent) {
        event.preventDefault()
        username = username?.trim()
        email = email?.trim()

        let payload = {
            username,
            email
        }

        let updatedUser = await api.updateUser(payload)
        authorizationService.setSessionUser(updatedUser)

        username = ''
        email = ''

        if (updatedUser.status === UserStatus.Active) {
            goto('/dashboard')
        }
    }

    async function verifyToken(event: SubmitEvent) {
        event.preventDefault()
        if (!verificationToken) {
            return
        }
        newEmailSent = false
        verificationToken = verificationToken.trim()

        try {
            let updatedUser = await api.verifyToken(verificationToken)
            verificationError = false

            authorizationService.setSessionUser(updatedUser)

            verificationToken = ''

            if (updatedUser.status === UserStatus.Active) {
                goto('/dashboard')
            }
        } catch (e) {
            verificationError = true
        }
    }

    async function sendVerificationEmail() {
        verificationError = false
        await api.sendVerificationEmail()
        newEmailSent = true
    }

    function trim(event: Event) {
        const input = event.target as HTMLInputElement
        input.value = input.value.trim()
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    {#if user && user.email && !user.emailVerified}
        <Card>
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">
                Verify your email...
            </h1>
            <Hr hrClass="my-4" />
            {#if verificationError}
                <Alert color="none" class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Verification Failed</span><br />
                    Please check to make sure you entered the correct token, and that the token was not
                    created more than 30 minutes ago.
                </Alert>
            {/if}
            {#if newEmailSent}
                <Alert color="none" class="dark:bg-green-200 dark:text-green-700 mb-4">
                    <span class="font-bold text-lg">Email Sent</span><br />
                    Please check your email for a new verification token.
                </Alert>
            {/if}
            <P class="dark:text-gray-300"
                >An email has been sent to <span class="dark:text-orange-300"
                    ><strong>{user.email}</strong></span
                > with a verification token. Please enter the token below to verify your email address.</P
            >
            <form class="flex flex-col space-y-6 mt-4" action="/" onsubmit={verifyToken}>
                <Label class="space-y-2">
                    <Input
                        bind:value={verificationToken}
                        on:input={trim}
                        type="text"
                        name="verificationToken"
                        placeholder="aBCdef"
                        required
                    />
                </Label>
                <div class="flex flex-row justify-between">
                    <Button on:click={sendVerificationEmail} color="light">Send New Token</Button
                    ><Button type="submit">Submit</Button>
                </div>
            </form>
        </Card>
    {:else}
        <Card>
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
                Complete your profile...
            </h1>
            <form class="flex flex-col space-y-6" action="/" onsubmit={updateUser}>
                {#if user && !user.username}
                    <Label class="space-y-2">
                        <span>Username</span>
                        <Input
                            bind:value={username}
                            on:input={trim}
                            type="text"
                            name="username"
                            placeholder="choose a username"
                            required
                        />
                    </Label>
                {/if}
                {#if user && !user.email}
                    <Label class="space-y-2">
                        <span>Email</span>
                        <Input
                            bind:value={email}
                            on:input={trim}
                            type="email"
                            name="email"
                            placeholder="name@company.com"
                            required
                        />
                    </Label>
                    <Helper class="text-sm mt-2">
                        We’ll never share your email publicly. It is only used for account recovery
                        and notifications.
                    </Helper>
                {/if}
                <div class="flex justify-end"><Button type="submit" class="">Submit</Button></div>
            </form>
        </Card>
    {/if}
</div>
