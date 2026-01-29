<script lang="ts">
    import { Card, Label, Input, Button, Alert, Helper, P } from 'flowbite-svelte'
    import { EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import { z } from 'zod'
    import { zfd } from 'zod-form-data'
    import { ExternalAuthService, UserStatus } from '@tabletop/common'
    import { InfoCircleSolid } from 'flowbite-svelte-icons'
    import { goto } from '$app/navigation'
    import { resolve } from '$app/paths'
    import googleLogo from '$lib/components/images/google.jpg'
    import discordLogo from '$lib/components/images/discord.png'
    import GoogleSignIn, {
        isEnabled as isGoogleSigninEnabled
    } from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn, {
        isEnabled as isDiscordSigninEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { getAppContext, trim } from '@tabletop/frontend-components'

    let { authorizationService, api } = getAppContext()

    const enum ReauthType {
        None = 'none',
        Password = 'password',
        Token = 'token'
    }

    const imageForLinkType = new Map<string, string>([
        ['google', googleLogo],
        ['discord', discordLogo]
    ])

    let errors: Record<string, string[]> = $state({})
    let errorMessage: string | undefined = $state(undefined)
    let success = $state(false)

    let passwordToggle = $state(false)
    let currentPasswordToggle = $state(false)
    let newEmailSent = $state(false)

    let sessionUser = authorizationService.getSessionUser()

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let linkedAccountIdsByType: Map<string, string> = $derived.by(() => {
        return new Map(
            user?.externalIds?.map((id) => {
                const split = id.split(':', 2)
                const type = split[0]
                return [type, id]
            }) ?? []
        )
    })

    let username: string | undefined = $state(sessionUser?.username)
    let password: string | undefined = $state(undefined)
    let email: string | undefined = $state(sessionUser?.email)
    let currentPassword: string | undefined = $state(undefined)
    let token: string | undefined = $state(undefined)

    let reauthType: ReauthType = $derived.by(() => {
        if (email == user?.email && !password) {
            return ReauthType.None
        }

        if (user?.hasPassword) {
            return ReauthType.Password
        } else {
            return ReauthType.Token
        }
    })

    const createUserSchema = zfd.formData({
        username: zfd.text(),
        password: zfd.text(z.string().min(12).optional()),
        email: zfd.text(z.string().email())
    })

    function togglePassword() {
        passwordToggle = !passwordToggle
    }

    function toggleCurrentPassword() {
        currentPasswordToggle = !currentPasswordToggle
    }

    async function unlink(externalId: string) {
        const newUser = await api.unlinkExternalAccount(externalId)
        authorizationService.setSessionUser(newUser)
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        clearErrors()
        success = false
        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const result = createUserSchema.safeParse(formData)
        if (!result.success) {
            errors = result.error.flatten().fieldErrors
            return
        }

        const data = Object.fromEntries(formData)

        if (data.username === user?.username) {
            delete data.username
        }

        if (data.email === user?.email) {
            delete data.email
        }

        if (!data.password) {
            delete data.password
        }

        if (Object.keys(data).length === 0) {
            return
        }

        try {
            const newUser = await api.updateUser(data)

            success = true
            password = undefined
            currentPassword = undefined
            token = undefined

            authorizationService.setSessionUser(newUser)

            if (newUser.status === UserStatus.Incomplete) {
                goto(resolve('/onboarding'))
            }
        } catch (e) {
            console.log(e)
            if (e instanceof Error && e.name === 'AuthenticationVerificationFailedError') {
                errorMessage = 'Invalid password, could not update profile.'
            } else if (e instanceof Error && e.name === 'AlreadyExistsError') {
                if (e.message.includes('username')) {
                    errors.username = ['Username already exists']
                } else if (e.message.includes('email')) {
                    errors.email = ['Email already exists']
                } else {
                    errorMessage = 'An unexpected error occurred, please try again'
                }
            } else {
                errorMessage = 'An unexpected error occurred, please try again'
            }
        }
    }

    async function sendVerificationEmail() {
        await api.sendAuthVerificationEmail()
        newEmailSent = true
    }

    function clearErrors() {
        errorMessage = undefined
        errors = {}
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    <Card class="bg-gray-300 p-4 sm:p-6">
        <form class="flex flex-col space-y-6" action="/" onsubmit={submit}>
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Edit your profile...</h3>
            {#if errorMessage}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Update Failed</span><br />
                    {errorMessage}
                </Alert>
            {/if}
            {#if success}
                <Alert class="dark:bg-green-200 dark:text-green-700 my-4">
                    <span class="font-bold text-lg">Profile Updated</span><br />
                </Alert>
            {/if}
            <Label class="mb-2">Username</Label>
            <Input
                bind:value={username}
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
            <Label class="mb-2">Password</Label>
            <Input
                bind:value={password}
                oninput={trim}
                type={passwordToggle ? 'text' : 'password'}
                name="password"
                placeholder="at least 12 characters"
            >
                {#snippet right()}
                    <button type="button" onclick={togglePassword} class="pointer-events-auto">
                        {#if passwordToggle}
                            <EyeSlashSolid class="w-5 h-5" />
                        {:else}
                            <EyeSolid class="w-5 h-5" />
                        {/if}
                    </button>
                {/snippet}
            </Input>
            {#if errors?.password}
                {#each errors.password as error, i (i)}
                    <Helper class="mb-2" color="red"
                        ><span class="font-medium">{error}</span></Helper
                    >
                {/each}
            {/if}
            <Label class="mb-2">Email</Label>
            <Input
                bind:value={email}
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
            <Label class="mb-2">Linked Accounts</Label>
            <div class="rounded-lg border-gray-600 border p-4">
                {#if isGoogleSigninEnabled}
                    <div class="flex flex-row justify-between items-end mb-2 h-[44px]">
                        <div class="rounded-lg overflow-hidden w-[40px] h-[40px] me-4">
                            <img
                                class="w-full h-full object-cover"
                                alt={ExternalAuthService.Google}
                                src={imageForLinkType.get(ExternalAuthService.Google)}
                            />
                        </div>
                        {#if linkedAccountIdsByType.get(ExternalAuthService.Google)}
                            <Button
                                class="rounded-full w-[100px]"
                                onclick={() => {
                                    unlink(linkedAccountIdsByType.get(ExternalAuthService.Google)!)
                                }}
                                color="light"
                                size="xs">Unlink</Button
                            >
                        {:else}
                            <GoogleSignIn mode="link" />
                        {/if}
                    </div>
                {/if}
                {#if isDiscordSigninEnabled}
                    <div class="flex flex-row justify-between items-center h-[44px]">
                        <div class="rounded-lg overflow-hidden w-[40px] h-[40px] me-4">
                            <img
                                class="w-full h-full object-cover"
                                alt={ExternalAuthService.Discord}
                                src={imageForLinkType.get(ExternalAuthService.Discord)}
                            />
                        </div>
                        {#if linkedAccountIdsByType.get(ExternalAuthService.Discord)}
                            <Button
                                class="rounded-full w-[100px]"
                                onclick={() => {
                                    unlink(linkedAccountIdsByType.get(ExternalAuthService.Discord)!)
                                }}
                                color="light"
                                size="xs">Unlink</Button
                            >
                        {:else}
                            <DiscordSignIn mode="link" />
                        {/if}
                    </div>
                {/if}
            </div>
            {#if reauthType === ReauthType.Password}
                <Alert border color="blue" class="dark:bg-transparent dark:text-blue-400">
                    {#snippet icon()}
                        <InfoCircleSolid class="w-5 h-5" />
                    {/snippet}
                    Because you are changing sensitive information, you must reauthenticate.<br
                    /><br />Please enter your current password.
                </Alert>
                <Label class="space-y-2">Current Password</Label>
                <Input
                    bind:value={currentPassword}
                    oninput={trim}
                    type={currentPasswordToggle ? 'text' : 'password'}
                    name="currentPassword"
                    placeholder="your current password"
                    required
                >
                    {#snippet right()}
                        <button
                            type="button"
                            onclick={toggleCurrentPassword}
                            class="pointer-events-auto"
                        >
                            {#if currentPasswordToggle}
                                <EyeSlashSolid class="w-5 h-5" />
                            {:else}
                                <EyeSolid class="w-5 h-5" />
                            {/if}
                        </button>
                    {/snippet}
                </Input>
            {/if}
            {#if reauthType === ReauthType.Token}
                <Alert border color="blue" class="dark:bg-transparent dark:text-blue-400">
                    In order to change sensitive information you must verify your authenticity.<br
                    /><br />
                    {#if !newEmailSent}
                        Click here to send a verification email with a token
                    {:else}
                        Email Sent! Check your inbox and enter the token below.
                    {/if}
                    <div class="flex justify-center">
                        <Button class="mt-4" onclick={sendVerificationEmail} color="blue"
                            >Send Token</Button
                        >
                    </div>
                </Alert>

                <Label class="space-y-2">Token</Label>
                <Input
                    bind:value={token}
                    oninput={trim}
                    name="token"
                    placeholder="abcDeF"
                    required
                />
            {/if}
            <div class="flex justify-end"><Button type="submit" class="">Submit</Button></div>
        </form>
    </Card>
</div>
