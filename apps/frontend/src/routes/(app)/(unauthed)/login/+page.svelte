<script lang="ts">
    import { Card } from 'flowbite-svelte'
    import LoginPanel, { loginViewTitles, type LoginView } from '$lib/components/LoginPanel.svelte'
    let view = $state<LoginView>('signin')
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center px-4">
    <Card class="p-4 sm:p-6 w-full max-w-sm">
        <h1 class="text-5xl font-medium text-gray-900 dark:text-gray-300 mb-6">
            {loginViewTitles[view]}
        </h1>
        <LoginPanel bind:view />
    </Card>
</div>
