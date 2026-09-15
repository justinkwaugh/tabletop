<script lang="ts">
    import { Card } from 'flowbite-svelte'
    import { goto } from '$app/navigation'
    import UsernameLoginForm from '$lib/components/UsernameLoginForm.svelte'
    import { hasSocialLogin } from '$lib/components/LoginPanel.svelte'
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center px-4">
    <Card class="p-4 sm:p-6 w-full max-w-sm">
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">Please login...</h1>
        <UsernameLoginForm onback={hasSocialLogin ? () => goto('/login') : undefined} />
    </Card>
</div>
