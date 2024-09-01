<script lang="ts">
    import { Card, Label, Button, Input, Alert, Helper } from 'flowbite-svelte'
    import { EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { goto } from '$app/navigation'
    import { trim } from '$lib/utils/trimInput'
    import { z } from 'zod'
    import { zfd } from 'zod-form-data'
    import { getContext } from 'svelte'

    let { api } = getContext('appContext') as AppContext
    let { data } = $props()

    let errors: Record<string, string[]> | null = $state(null)

    let passwordToggle = $state(false)
    let resetFailed = $state(false)
    let resetSuccess = $state(false)

    const passwordSchema = zfd.formData({
        password: zfd.text(z.string().min(12))
    })

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const result = passwordSchema.safeParse(formData)
        if (!result.success) {
            errors = result.error.flatten().fieldErrors
            return
        }

        const formObj = Object.fromEntries(formData)

        try {
            await api.updatePassword({
                password: formObj.password as string,
                token: data.token
            })
            resetFailed = false
            resetSuccess = true
            errors = null
            form.reset()
        } catch (e) {
            resetFailed = true
        }
    }

    function togglePassword() {
        passwordToggle = !passwordToggle
    }

    function gotoDashboard() {
        goto('/dashboard')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center">
    <Card>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
            Enter your new password...
        </h1>
        {#if resetFailed}
            <Alert color="none" class="dark:bg-red-200 dark:text-red-700 mb-4">
                <span class="font-bold text-lg">Password Reset Failed</span><br />
                An unknown error occurred. Please try again.
            </Alert>
        {/if}
        {#if resetSuccess}
            <Alert color="none" class="dark:bg-green-200 dark:text-green-700 my-4">
                <span class="font-bold text-lg">Success!</span><br />
                <div class="flex justify-center mt-4">
                    <Button color="green" on:click={gotoDashboard} class="mt-4"
                        >Continue to Dashboard</Button
                    >
                </div>
            </Alert>
        {:else}
            <form class="flex flex-col space-y-4" action="/" onsubmit={submit}>
                <Label class="space-y-2">
                    <span>New Password</span>
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
                    {#if errors?.password}
                        {#each errors.password as error}
                            <Helper class="mb-2" color="red"
                                ><span class="font-medium">{error}</span></Helper
                            >
                        {/each}
                    {/if}
                </Label>
                <div class="flex justify-end mt-6">
                    <div><Button type="submit">Submit</Button></div>
                </div>
            </form>
        {/if}
    </Card>
</div>
