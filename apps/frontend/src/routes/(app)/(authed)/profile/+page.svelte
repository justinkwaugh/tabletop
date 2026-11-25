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
    import DeleteAccountCard from '$lib/components/DeleteAccountCard.svelte'
    import { isAlreadyExists, isUsernameNotAllowed } from '$lib/utils/accountErrors'
    import { broadcastLogout } from '$lib/utils/logoutChannel'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'
    import { m } from '$lib/paraglide/messages'

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
        username: zfd.text(z.string(m.auth_validation_required())),
        password: zfd.text(
            z
                .string()
                .min(12, m.auth_validation_min_length({ length: 12 }))
                .optional()
        )
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
            purpose: data.password ? 'change-password' : 'update-profile',
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
            if (isUsernameNotAllowed(e)) {
                errors.username = [e.message]
            } else if (isAlreadyExists(e)) {
                if (e.message.includes('username')) {
                    errors.username = [m.profile_username_exists()]
                } else {
                    errorMessage = m.unexpected_error_try_again()
                }
            } else {
                errorMessage = m.unexpected_error_try_again()
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
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                {m.profile_heading()}
            </h3>
            {#if errorMessage}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">{m.profile_update_failed()}</span><br />
                    {errorMessage}
                </Alert>
            {/if}
            {#if success}
                <Alert class="dark:bg-green-200 dark:text-green-700 my-4">
                    <span class="font-bold text-lg">{m.profile_updated()}</span><br />
                </Alert>
            {/if}
            <Label class="mb-2">{m.profile_username()}</Label>
            <Input
                bind:value={username}
                type="text"
                name="username"
                placeholder={m.profile_username_placeholder()}
                required
            />
            {#if errors?.username}
                {#each errors.username as error, i (i)}
                    <Helper class="mb-2" color="red"
                        ><span class="font-medium">{error}</span></Helper
                    >
                {/each}
            {/if}
            <Label class="mb-2">{m.profile_password()}</Label>
            <Input
                bind:value={password}
                oninput={trim}
                type={passwordToggle ? 'text' : 'password'}
                name="password"
                placeholder={m.profile_password_placeholder()}
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
            <Label class="mb-2">{m.profile_linked_accounts()}</Label>
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
                                size="xs">{m.profile_unlink()}</Button
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
                                size="xs">{m.profile_unlink()}</Button
                            >
                        {:else}
                            <DiscordSignIn mode="link" />
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="flex justify-end">
                <Button type="submit" disabled={submitting}
                    >{submitting ? m.saving() : m.submit()}</Button
                >
            </div>
        </form>
        <EmailChange />
        <div class="mt-6">
            <TimeZonePicker />
        </div>
        <div class="mt-6 flex items-center justify-between gap-4">
            <P class="text-sm text-gray-700 dark:text-gray-400"
                >{m.profile_sign_out_everywhere_explanation()}</P
            >
            <Button color="alternative" size="sm" onclick={logoutEverywhere}
                >{m.profile_sign_out_everywhere()}</Button
            >
        </div>
        {#if logoutEverywhereFailed}
            <Alert class="dark:bg-red-200 dark:text-red-700 mt-4">
                <span class="font-bold text-lg">{m.profile_sign_out_everywhere_failed()}</span><br
                />
                {m.profile_sign_out_everywhere_failed_detail()}
            </Alert>
        {/if}
    </Card>
    <DeleteAccountCard />
</div>
