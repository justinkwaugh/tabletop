<script lang="ts">
    import { Label, Input, Button, Helper, Alert } from 'flowbite-svelte'
    import { z } from 'zod'
    import { getAppContext, trim } from '@tabletop/frontend-components'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import AuthLink from '$lib/components/AuthLink.svelte'
    import AgeConfirmation from '$lib/components/AgeConfirmation.svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'
    import { getLocale } from '$lib/paraglide/runtime'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'
    import { isAlreadyExists, isUsernameNotAllowed } from '$lib/utils/accountErrors'
    import { emailAddress } from '$lib/utils/accountFormValidation'

    let { onsignin }: { onsignin?: () => void } = $props()
    const { authorizationService, api } = getAppContext()
    const id = $props.id()
    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let submitting = $state(false)
    let username = $state('')
    let password = $state('')
    let email = $state('')
    let ageConfirmed = $state(false)

    const createUserSchema = z.object({
        username: z
            .string()
            .trim()
            .min(1, m.auth_validation_min_length({ length: 1 })),
        password: z
            .string()
            .trim()
            .min(12, m.auth_validation_min_length({ length: 12 })),
        email: z.string().trim().pipe(emailAddress()),
        ageConfirmed: z.literal(true, { error: m.auth_validation_age_confirmation() })
    })

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        unexpectedError = false
        errors = {}
        const result = createUserSchema.safeParse({ username, password, email, ageConfirmed })
        if (!result.success) {
            errors = z.flattenError(result.error).fieldErrors
            return
        }
        submitting = true
        try {
            const newUser = await api.createUser({ ...result.data, seenLocale: getLocale() })
            await authorizationService.onLogin(newUser)
        } catch (error) {
            if (isUsernameNotAllowed(error)) {
                errors.username = [error.message]
            } else if (isAlreadyExists(error)) {
                if (error.message.includes('username')) {
                    errors.username = [m.auth_username_exists()]
                } else if (error.message.includes('email')) {
                    errors.email = [m.auth_email_exists()]
                } else {
                    unexpectedError = true
                }
            } else {
                unexpectedError = true
            }
        } finally {
            submitting = false
        }
    }
</script>

{#snippet signinLink(text: string)}<AuthLink href="/login" onactivate={onsignin}>{text}</AuthLink
    >{/snippet}

{#if unexpectedError}
    <Alert color="red" class="mb-4" role="alert">
        {m.auth_signup_failed()}
    </Alert>
{/if}

<form class="flex flex-col gap-4" onsubmit={submit} {@attach focusFirstInput}>
    <div>
        <Label for={`${id}-username`} class="mb-2">{m.auth_username()}</Label>
        <Input
            class="auth-input"
            id={`${id}-username`}
            bind:value={username}
            oninput={trim}
            name="username"
            autocomplete="username"
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? `${id}-username-error` : undefined}
            required
        />
        {#if errors.username}
            <Helper id={`${id}-username-error`} color="red" class="mt-2" role="alert">
                {errors.username.join('. ')}
            </Helper>
        {/if}
    </div>
    <div>
        <Label for={`${id}-password`} class="mb-2">{m.auth_password()}</Label>
        <PasswordInput
            id={`${id}-password`}
            bind:value={password}
            autocomplete="new-password"
            minlength={12}
            invalid={Boolean(errors.password)}
            describedby={`${id}-password-help`}
        />
        <Helper id={`${id}-password-help`} color={errors.password ? 'red' : 'gray'} class="mt-2">
            {errors.password ? errors.password.join('. ') : m.auth_password_min_length_help()}
        </Helper>
    </div>
    <div>
        <Label for={`${id}-email`} class="mb-2">{m.auth_email()}</Label>
        <Input
            class="auth-input"
            id={`${id}-email`}
            bind:value={email}
            oninput={trim}
            type="email"
            name="email"
            autocomplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={`${id}-email-help`}
            required
        />
        <Helper id={`${id}-email-help`} color={errors.email ? 'red' : 'gray'} class="mt-2">
            {#if errors.email}
                <span role="alert">{errors.email.join('. ')}</span>
            {:else}
                {m.auth_signup_email_help()}
            {/if}
        </Helper>
    </div>
    <AgeConfirmation bind:checked={ageConfirmed} errors={errors.ageConfirmed} />
    <div class="flex items-center justify-between gap-4 mt-4">
        <p class="auth-secondary text-sm text-gray-600 dark:text-gray-300">
            <RichMessage parts={m.auth_have_account.parts()} markup={{ signin: signinLink }} />
        </p>
        <Button color="blue" type="submit" class="shrink-0" disabled={submitting}>
            {submitting ? m.auth_signup_creating() : m.auth_sign_up()}
        </Button>
    </div>
</form>
