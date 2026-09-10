<script lang="ts">
    import { Card } from 'flowbite-svelte'
    import SignupForm from '$lib/components/SignupForm.svelte'
</script>

<svelte:head>
    <title>Create an account — Board Together</title>
</svelte:head>

<div class="min-h-[calc(100dvh-70px)] flex flex-col items-center justify-center px-4 py-8">
    <Card class="p-4 sm:p-6 w-full max-w-md">
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
            Create an account
        </h1>
        <SignupForm />
    </Card>
</div>
