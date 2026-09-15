<script lang="ts">
    import { goto } from '$app/navigation'
    import LandingPage from '$lib/components/LandingPage.svelte'
    import AuthModal from '$lib/components/AuthModal.svelte'
    import ForgotPasswordForm from '$lib/components/ForgotPasswordForm.svelte'

    let open = $state(true)
</script>

<svelte:head>
    <title>Reset password — Board Together</title>
</svelte:head>

<LandingPage />
<AuthModal bind:open title="Reset password" variant="form" oncancel={() => goto('/')}>
    <ForgotPasswordForm onback={() => goto('/login/username')} />
</AuthModal>
