<script lang="ts">
    import LandingPage from '$lib/components/LandingPage.svelte'
    import { m } from '$lib/paraglide/messages'
</script>

<svelte:head>
    <title>{m.content_landing_page_title()}</title>
    <meta name="description" content={m.content_landing_page_description()} />
</svelte:head>

<LandingPage />
