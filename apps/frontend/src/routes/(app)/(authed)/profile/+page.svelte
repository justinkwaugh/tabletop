<script lang="ts">
    import { Card, Label, Input, Button, Alert, Helper, P } from 'flowbite-svelte'
    import { EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import { z } from 'zod'
    import { zfd } from 'zod-form-data'
    import { assert, ExternalAuthService, externalIdentityProvider } from '@tabletop/common'
    import googleLogo from '$lib/components/images/google.jpg'
    import discordLogo from '$lib/components/images/discord.png'
    import GoogleSignIn, {
        isEnabled as isGoogleSigninEnabled
    } from '$lib/components/GoogleSignIn.svelte'
    import DiscordSignIn, {
        isEnabled as isDiscordSigninEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { getAppContext, trim } from '@tabletop/frontend-components'
    import TimeZonePicker from '$lib/components/TimeZonePicker.svelte'
    import EmailChange from '$lib/components/EmailChange.svelte'
    import { minLengthMessage, requiredMessage } from '$lib/utils/accountFormValidation'
    import { broadcastLogout } from '$lib/utils/logoutChannel'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'

    let { authorizationService, api } = getAppContext()

    const imageForLinkType = new Map<string, string>([
        ['google', googleLogo],
        ['discord', discordLogo]
    ])

    let errors: Record<string, string[]> = $state({})
    let errorMessage: string | undefined = $state(undefined)
    let success = $state(false)
    let submitting = $state(false)

    let passwordToggle = $state(false)

    let sessionUser = authorizationService.getSessionUser()

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let linkedAccountIdsByType: Map<string, string> = $derived.by(() => {
        return new Map(user?.externalIds?.map((id) => [externalIdentityProvider(id), id]) ?? [])
    })

    let username: string | undefined = $state(sessionUser?.username)
    let password: string | undefined = $state(undefined)

    const updateProfileSchema = zfd.formData({
        username: zfd.text(z.string(requiredMessage)),
        password: zfd.text(z.string().min(12, minLengthMessage(12)).optional())
    })

    function togglePassword() {
        passwordToggle = !passwordToggle
    }

    async function unlink(externalId: string) {
        const newUser = await api.unlinkExternalAccount(externalId)
        authorizationService.setSessionUser(newUser)
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        clearErrors()
        success = false
        const form = event.currentTarget
        assert(form instanceof HTMLFormElement, 'Profile submission comes from its form')
        const formData = new FormData(form)
        const result = updateProfileSchema.safeParse(formData)
        if (!result.success) {
            errors = z.flattenError(result.error).fieldErrors
            return
        }

        const data = {
            username: result.data.username !== user?.username ? result.data.username : undefined,
            password: result.data.password
        }
        if (!data.username && !data.password) {
            return
        }
        await reauthentication.run({
            description: data.password ? 'change your password' : 'update your profile',
            retry: () => save(data)
        })
    }

    async function save(data: Partial<z.infer<typeof updateProfileSchema>>) {
        submitting = true
        try {
            const newUser = await api.updateUser(data)
            success = true
            password = undefined
            authorizationService.setSessionUser(newUser)
        } catch (e) {
            if (requiresRecentAuthentication(e)) throw e
            if (e instanceof Error && e.name === 'AlreadyExistsError') {
                if (e.message.includes('username')) {
                    errors.username = ['Username already exists']
                } else {
                    errorMessage = 'An unexpected error occurred, please try again'
                }
            } else {
                errorMessage = 'An unexpected error occurred, please try again'
            }
        } finally {
            submitting = false
        }
    }

    function clearErrors() {
        errorMessage = undefined
        errors = {}
    }

    let logoutEverywhereFailed = $state(false)

    async function logoutEverywhere() {
        logoutEverywhereFailed = false
        try {
            await api.logoutAll()
        } catch {
            logoutEverywhereFailed = true
            return
        }
        broadcastLogout()
        await authorizationService.onLogout()
    }
</script>

<div class="min-h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6 py-6">
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
            <div class="flex justify-end">
                <Button type="submit" disabled={submitting}
                    >{submitting ? 'Saving…' : 'Submit'}</Button
                >
            </div>
        </form>
        <EmailChange />
        <div class="mt-6">
            <TimeZonePicker />
        </div>
        <div class="mt-6 flex items-center justify-between gap-4">
            <P class="text-sm text-gray-700 dark:text-gray-400"
                >Signed in somewhere you no longer trust? Sign out of every device, including this
                one.</P
            >
            <Button color="alternative" size="sm" onclick={logoutEverywhere}
                >Sign out everywhere</Button
            >
        </div>
        {#if logoutEverywhereFailed}
            <Alert class="dark:bg-red-200 dark:text-red-700 mt-4">
                <span class="font-bold text-lg">We could not confirm the sign-out</span><br />
                Other sessions may still be active. Please try again.
            </Alert>
        {/if}
    </Card>
</div>
