<script lang="ts">
    import { goto } from '$app/navigation'
    import LandingPage from '$lib/components/LandingPage.svelte'
    import AuthModal from '$lib/components/AuthModal.svelte'
    import ForgotPasswordForm from '$lib/components/ForgotPasswordForm.svelte'
    import { m } from '$lib/paraglide/messages'

    let open = $state(true)
</script>

<svelte:head>
    <title>{m.auth_page_title_reset_password()}</title>
</svelte:head>

<LandingPage />
<AuthModal
    bind:open
    title={m.auth_title_reset_password()}
    variant="form"
    oncancel={() => goto('/')}
>
    <ForgotPasswordForm onback={() => goto('/login/username')} />
</AuthModal>
