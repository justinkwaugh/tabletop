<script lang="ts">
    import { Label, Input, Button, Helper, Alert } from 'flowbite-svelte'
    import { z } from 'zod'
    import { goto } from '$app/navigation'
    import { getAppContext, trim } from '@tabletop/frontend-components'
    import PasswordInput from '$lib/components/PasswordInput.svelte'
    import AuthLink from '$lib/components/AuthLink.svelte'
    import { focusFirstInput } from '$lib/utils/focusFirstInput'

    let { onsignin }: { onsignin?: () => void } = $props()
    const { authorizationService, api } = getAppContext()
    const id = $props.id()
    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let submitting = $state(false)
    let username = $state('')
    let password = $state('')
    let email = $state('')

    const createUserSchema = z.object({
        username: z.string().trim().min(1),
        password: z.string().trim().min(12),
        email: z.string().trim().email()
    })

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (submitting) return
        unexpectedError = false
        errors = {}
        const result = createUserSchema.safeParse({ username, password, email })
        if (!result.success) {
            errors = result.error.flatten().fieldErrors
            return
        }
        submitting = true
        try {
            const newUser = await api.createUser(result.data)
            authorizationService.setSessionUser(newUser)
            await goto('/library')
        } catch (error) {
            if (error instanceof Error && error.name === 'AlreadyExistsError') {
                if (error.message.includes('username')) {
                    errors.username = ['Username already exists']
                } else if (error.message.includes('email')) {
                    errors.email = ['Email already exists']
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

{#if unexpectedError}
    <Alert color="red" class="mb-4" role="alert">
        We couldn’t create your account. Please try again.
    </Alert>
{/if}

<form class="flex flex-col gap-4" onsubmit={submit} {@attach focusFirstInput}>
    <div>
        <Label for={`${id}-username`} class="mb-2">Username</Label>
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
        <Label for={`${id}-password`} class="mb-2">Password</Label>
        <PasswordInput
            id={`${id}-password`}
            bind:value={password}
            autocomplete="new-password"
            minlength={12}
            invalid={Boolean(errors.password)}
            describedby={`${id}-password-help`}
        />
        <Helper id={`${id}-password-help`} color={errors.password ? 'red' : 'gray'} class="mt-2">
            {errors.password ? errors.password.join('. ') : 'Use at least 12 characters.'}
        </Helper>
    </div>
    <div>
        <Label for={`${id}-email`} class="mb-2">Email</Label>
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
                Kept private. Used only for account recovery and notifications.
            {/if}
        </Helper>
    </div>
    <div class="flex items-center justify-between gap-4 mt-4">
        <p class="auth-secondary text-sm text-gray-600 dark:text-gray-300">
            Have an account? <AuthLink href="/login" onactivate={onsignin}>Sign in</AuthLink>
        </p>
        <Button color="blue" type="submit" class="shrink-0" disabled={submitting}>
            {submitting ? 'Creating…' : 'Sign up'}
        </Button>
    </div>
</form>
