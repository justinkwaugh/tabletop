<script lang="ts">
    import { Card, Label, A, Button, Hr, P, Input, Helper, Alert } from 'flowbite-svelte'
    import { EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import { type Credentials, TabletopApi } from '@tabletop/frontend-components'
    import { goto } from '$app/navigation'
    import { trim } from '$lib/utils/trimInput'
    import { getContext } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    let { authorizationService, api } = getContext('appContext') as AppContext

    let passwordToggle = $state(false)
    let loginFailed = $state(false)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const data = Object.fromEntries(formData)

        try {
            const sessionUser = await api.login(data as Credentials)
            loginFailed = false
            form.reset()
            await authorizationService.onLogin(sessionUser)
        } catch (e) {
            loginFailed = true
        }
    }

    function togglePassword() {
        passwordToggle = !passwordToggle
    }

    function backToLogin() {
        goto('/login')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center">
    <Card>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">Please login...</h1>
        {#if loginFailed}
            <Alert color="none" class="dark:bg-red-200 dark:text-red-700 mb-4">
                <span class="font-bold text-lg">Login Failed</span><br />
                Invalid username or password
            </Alert>
        {/if}
        <form class="flex flex-col space-y-4" action="/" onsubmit={submit}>
            <Label class="space-y-2">
                <span>Username</span>
                <Input on:input={trim} type="text" name="username" placeholder="" required />
            </Label>
            <Label class="space-y-2">
                <span>Password</span>
                <Input
                    on:input={trim}
                    type={passwordToggle ? 'text' : 'password'}
                    name="password"
                    placeholder=""
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
                <Helper align="right"
                    ><a
                        href="/forgot/password"
                        class="font-medium hover:underline dark:text-orange-300">Forgot password?</a
                    ></Helper
                >
            </Label>
            <div class="flex justify-between mt-6">
                <div><Button color="light" onclick={backToLogin}>Back</Button></div>
                <div><Button type="submit">Submit</Button></div>
            </div>
        </form>
    </Card>
</div>
