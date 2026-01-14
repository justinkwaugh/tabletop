<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert, P, Hr } from 'flowbite-svelte'
    import { goto } from '$app/navigation'
    import { UserStatus } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'

    let { authorizationService, api } = getAppContext()

    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
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

        try {
            let updatedUser = await api.updateUser(payload)
            authorizationService.setSessionUser(updatedUser)

            username = ''
            email = ''

            if (updatedUser.status === UserStatus.Active) {
                goto('/activeGamesCheck')
            }
        } catch (e) {
            if (e instanceof Error && e.name === 'AlreadyExistsError') {
                if (e.message.includes('username')) {
                    errors.username = ['Username already exists']
                } else if (e.message.includes('email')) {
                    errors.email = ['Email already exists']
                } else {
                    unexpectedError = true
                }
            } else {
                unexpectedError = true
            }
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
                goto('/activeGamesCheck')
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
        <Card class="p-4 sm:p-6">
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">
                Verify your email...
            </h1>
            <Hr class="my-4" />
            {#if unexpectedError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Oops...</span><br />
                    An unexpected error occurred. Please try again and hopefully it will be better next
                    time.
                </Alert>
            {/if}
            {#if verificationError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Verification Failed</span><br />
                    Please check to make sure you entered the correct token, and that the token was not
                    created more than 30 minutes ago.
                </Alert>
            {/if}
            {#if newEmailSent}
                <Alert class="dark:bg-green-200 dark:text-green-700 mb-4">
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
                <Input
                    bind:value={verificationToken}
                    oninput={trim}
                    type="text"
                    name="verificationToken"
                    placeholder="aBCdef"
                    required
                />
                <div class="flex flex-row justify-between">
                    <Button onclick={sendVerificationEmail} color="light">Send New Token</Button
                    ><Button type="submit">Submit</Button>
                </div>
            </form>
        </Card>
    {:else}
        <Card class="p-4 sm:p-6">
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
                Complete your profile...
            </h1>
            {#if unexpectedError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Oops...</span><br />
                    An unexpected error occurred. Please try again and hopefully it will be better next
                    time.
                </Alert>
            {/if}
            <form class="flex flex-col space-y-6" action="/" onsubmit={updateUser}>
                {#if user && !user.username}
                    <Label class="mb-2">Username</Label>
                    <Input
                        bind:value={username}
                        oninput={trim}
                        type="text"
                        name="username"
                        placeholder="choose a username"
                        required
                    />
                    {#if errors?.username}
                        {#each errors.username as error, i (i)}
                            <Helper class="mb-2" color="red"
                                ><span class="font-medium">{error}</span></Helper
                            >
                        {/each}
                    {/if}
                {/if}
                {#if user && !user.email}
                    <Label class="mb-2">Email</Label>
                    <Input
                        bind:value={email}
                        oninput={trim}
                        type="email"
                        name="email"
                        placeholder="name@company.com"
                        required
                    />
                    {#if errors?.email}
                        {#each errors.email as error, i (i)}
                            <Helper class="mb-2" color="red"
                                ><span class="font-medium">{error}</span></Helper
                            >
                        {/each}
                    {/if}
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
