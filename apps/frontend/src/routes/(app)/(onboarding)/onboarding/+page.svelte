<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert, P, Hr } from 'flowbite-svelte'
    import { ABANDONED_SIGN_UP_DAYS, UserStatus, type UserUpdateRequest } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { challengeExpiryText } from '$lib/utils/challengeExpiry'
    import { isAlreadyExists, isUsernameNotAllowed } from '$lib/utils/accountErrors'
    import AgeConfirmation from '$lib/components/AgeConfirmation.svelte'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'

    let { authorizationService, api } = getAppContext()

    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let username: string | undefined = $state(undefined)
    let email: string | undefined = $state(undefined)
    let ageConfirmed = $state(false)
    let verificationToken: string | undefined = $state(undefined)
    let verificationError = $state(false)
    let newEmailSent = $state(false)
    let codeExpiresAt: Date | undefined = $state(undefined)

    let user = $derived(authorizationService.getSessionUser())
    let neverActivated = $derived(Boolean(user && !user.activatedAt))

    async function updateUser(event: SubmitEvent) {
        event.preventDefault()
        username = username?.trim()
        email = email?.trim()
        errors = {}
        if (user && !user.ageConfirmedAt && !ageConfirmed) {
            errors.ageConfirmed = [m.auth_validation_age_confirmation()]
            return
        }

        const payload: UserUpdateRequest = {
            username,
            email,
            ageConfirmed: ageConfirmed ? true : undefined
        }
        await reauthentication.run({
            purpose: email ? 'update-email' : 'complete-profile',
            retry: () => saveProfile(payload)
        })
    }

    async function saveProfile(payload: UserUpdateRequest) {
        try {
            let updatedUser = await api.updateUser(payload)
            authorizationService.setSessionUser(updatedUser)

            username = ''
            email = ''

            if (updatedUser.status === UserStatus.Active) {
                await authorizationService.onLogin(updatedUser)
            }
        } catch (e) {
            if (requiresRecentAuthentication(e)) throw e
            if (isUsernameNotAllowed(e)) {
                errors.username = [e.message]
            } else if (isAlreadyExists(e)) {
                if (e.message.includes('username')) {
                    errors.username = [m.auth_username_exists()]
                } else if (e.message.includes('email')) {
                    errors.email = [m.auth_email_exists()]
                } else {
                    unexpectedError = true
                }
            } else {
                unexpectedError = true
            }
        }
    }

    async function verifyEmail(event: SubmitEvent) {
        event.preventDefault()
        if (!verificationToken) {
            return
        }
        newEmailSent = false
        verificationToken = verificationToken.trim()

        try {
            let updatedUser = await api.verifyEmail(verificationToken)
            verificationError = false

            authorizationService.setSessionUser(updatedUser)

            verificationToken = ''

            if (updatedUser.status === UserStatus.Active) {
                await authorizationService.onLogin(updatedUser)
            }
        } catch (e) {
            verificationError = true
        }
    }

    async function sendVerificationEmail() {
        verificationError = false
        codeExpiresAt = await api.sendVerificationEmail()
        newEmailSent = true
    }

    function trim(event: Event) {
        const input = event.target as HTMLInputElement
        input.value = input.value.trim()
    }
</script>

{#snippet signUpDeadline()}
    {#if neverActivated}
        <P class="text-sm mt-4 text-gray-500 dark:text-gray-400"
            >{m.auth_onboarding_signup_deadline({ days: ABANDONED_SIGN_UP_DAYS })}</P
        >
    {/if}
{/snippet}

{#snippet address(text: string)}<span class="dark:text-orange-300"><strong>{text}</strong></span
    >{/snippet}

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    {#if user && user.email && !user.emailVerified}
        <Card class="p-4 sm:p-6">
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">
                {m.auth_onboarding_verify_heading()}
            </h1>
            <Hr class="my-4" />
            {#if unexpectedError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">{m.auth_onboarding_oops()}</span><br />
                    {m.auth_onboarding_unexpected_error()}
                </Alert>
            {/if}
            {#if verificationError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">{m.auth_onboarding_verification_failed()}</span
                    ><br />
                    {m.auth_onboarding_verification_failed_detail()}
                </Alert>
            {/if}
            {#if newEmailSent}
                <Alert class="dark:bg-green-200 dark:text-green-700 mb-4">
                    <span class="font-bold text-lg">{m.auth_onboarding_email_sent()}</span><br />
                    {m.auth_onboarding_check_email()}
                    {#if codeExpiresAt}{challengeExpiryText(codeExpiresAt)}{/if}
                </Alert>
            {/if}
            <P class="dark:text-gray-300"
                ><RichMessage
                    parts={m.auth_onboarding_token_sent.parts({ email: user.email })}
                    markup={{ address }}
                /></P
            >
            <form class="flex flex-col space-y-6 mt-4" action="/" onsubmit={verifyEmail}>
                <Input
                    bind:value={verificationToken}
                    oninput={trim}
                    type="text"
                    name="verificationToken"
                    placeholder="aBCdef"
                    required
                />
                <div class="flex flex-row justify-between">
                    <Button onclick={sendVerificationEmail} color="light"
                        >{m.auth_onboarding_send_new_token()}</Button
                    ><Button type="submit">{m.submit()}</Button>
                </div>
            </form>
            {@render signUpDeadline()}
        </Card>
    {:else}
        <Card class="p-4 sm:p-6">
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
                {m.auth_onboarding_complete_heading()}
            </h1>
            {#if unexpectedError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">{m.auth_onboarding_oops()}</span><br />
                    {m.auth_onboarding_unexpected_error()}
                </Alert>
            {/if}
            <form class="flex flex-col space-y-6" action="/" onsubmit={updateUser}>
                {#if user && !user.username}
                    <Label class="mb-2">{m.auth_username()}</Label>
                    <Input
                        bind:value={username}
                        oninput={trim}
                        type="text"
                        name="username"
                        placeholder={m.auth_username_placeholder()}
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
                    <Label class="mb-2">{m.auth_email()}</Label>
                    <Input
                        bind:value={email}
                        oninput={trim}
                        type="email"
                        name="email"
                        placeholder={m.auth_email_placeholder()}
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
                        {m.auth_onboarding_email_privacy()}
                    </Helper>
                {/if}
                {#if user && !user.ageConfirmedAt}
                    <AgeConfirmation bind:checked={ageConfirmed} errors={errors.ageConfirmed} />
                {/if}
                <div class="flex justify-end">
                    <Button type="submit" class="">{m.submit()}</Button>
                </div>
            </form>
            {@render signUpDeadline()}
        </Card>
    {/if}
</div>
