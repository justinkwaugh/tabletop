<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert } from 'flowbite-svelte'
    import { InfoCircleSolid, EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import { z } from 'zod'
    import { zfd } from 'zod-form-data'

    import { goto } from '$app/navigation'
    import { trim } from '$lib/utils/trimInput'
    import { getContext } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    const { authorizationService, api } = getContext('appContext') as AppContext

    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let passwordToggle: boolean = $state(false)

    let username: string | undefined = $state(undefined)
    let password: string | undefined = $state(undefined)
    let email: string | undefined = $state(undefined)

    const createUserSchema = zfd.formData({
        username: zfd.text(),
        password: zfd.text(z.string().min(12)),
        email: zfd.text(z.string().email())
    })

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        clearErrors()

        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const result = createUserSchema.safeParse(formData)
        if (!result.success) {
            errors = result.error.flatten().fieldErrors
            return
        }
        const data = Object.fromEntries(formData)
        try {
            const newUser = await api.createUser(data)
            form.reset()
            authorizationService.setSessionUser(newUser)
            goto('/dashboard')
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

    function clearErrors() {
        unexpectedError = false
        errors = {}
    }

    function togglePassword() {
        passwordToggle = !passwordToggle
    }

    function backToLogin() {
        goto('/login')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    <Card>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">Create a user...</h1>
        {#if unexpectedError}
            <Alert color="none" class="dark:bg-red-200 dark:text-red-700 mb-4">
                <span class="font-bold text-lg">Oops...</span><br />
                An unexpected error occurred. Please try again and hopefully it will be better next time.
            </Alert>
        {/if}
        <form class="flex flex-col space-y-4" action="/" onsubmit={submit}>
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
                {#if errors?.username}
                    {#each errors.username as error}
                        <Helper class="mb-2" color="red"
                            ><span class="font-medium">{error}</span></Helper
                        >
                    {/each}
                {/if}
            </Label>
            <Label class="space-y-2">
                <span>Password</span>
                <Input
                    bind:value={password}
                    on:input={trim}
                    type={passwordToggle ? 'text' : 'password'}
                    name="password"
                    placeholder="at least 12 characters"
                    required
                >
                    <button
                        type="button"
                        slot="right"
                        onclick={togglePassword}
                        class="pointer-events-auto"
                    >
                        {#if passwordToggle}
                            <EyeSlashSolid class="w-5 h-5" />
                        {:else}
                            <EyeSolid class="w-5 h-5" />
                        {/if}
                    </button>
                </Input>
                {#if errors?.password}
                    {#each errors.password as error}
                        <Helper class="mb-2" color="red"
                            ><span class="font-medium">{error}</span></Helper
                        >
                    {/each}
                {/if}
            </Label>
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
                {#if errors?.email}
                    {#each errors.email as error}
                        <Helper class="mb-2" color="red"
                            ><span class="font-medium">{error}</span></Helper
                        >
                    {/each}
                {/if}
            </Label>
            <Alert border color="dark">
                <InfoCircleSolid slot="icon" class="w-5 h-5" />
                We’ll never share your email publicly.<br />It is only used for account recovery and
                notifications.
            </Alert>
            <div class="flex justify-between mt-6">
                <div><Button color="light" onclick={backToLogin}>Back</Button></div>
                <div><Button type="submit">Submit</Button></div>
            </div>
        </form>
    </Card>
</div>
