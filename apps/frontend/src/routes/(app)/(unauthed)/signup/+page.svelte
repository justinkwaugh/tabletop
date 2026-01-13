<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert } from 'flowbite-svelte'
    import { InfoCircleSolid, EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import { z } from 'zod'
    import { zfd } from 'zod-form-data'

    import { goto } from '$app/navigation'
    import { getAppContext, trim } from '@tabletop/frontend-components'

    const { authorizationService, api } = getAppContext()
    
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
            goto('/library')
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
    <Card class="p-4 sm:p-6">
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">Create a user...</h1>
        {#if unexpectedError}
            <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                <span class="font-bold text-lg">Oops...</span><br />
                An unexpected error occurred. Please try again and hopefully it will be better next time.
            </Alert>
        {/if}
        <form class="flex flex-col space-y-4" action="/" onsubmit={submit}>
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
                {#each errors.username as error}
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
                required
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
                {#each errors.password as error}
                    <Helper class="mb-2" color="red"
                        ><span class="font-medium">{error}</span></Helper
                    >
                {/each}
            {/if}
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
                {#each errors.email as error}
                    <Helper class="mb-2" color="red"
                        ><span class="font-medium">{error}</span></Helper
                    >
                {/each}
            {/if}
            <Alert border color="gray" class="dark:bg-transparent dark:border-color-gray-300">
                {#snippet icon()}
                    <InfoCircleSolid class="w-5 h-5" />
                {/snippet}
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
