<script lang="ts">
    import { goto } from '$app/navigation'
    import { Role } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import TournamentForm from '$lib/components/tournaments/TournamentForm.svelte'
    const { authorizationService } = getAppContext()
    let isAdmin = $derived(authorizationService.getSessionUser()?.roles.includes(Role.Admin))
</script>

<svelte:head><title>Create tournament · Tabletop</title></svelte:head>
<main class="mx-auto max-w-3xl space-y-6 px-4 py-8 text-gray-900 dark:text-gray-100">
    <a class="text-blue-700 dark:text-blue-300" href="/tournaments">← Tournaments</a>
    <h1 class="text-3xl font-semibold">Create a tournament</h1>
    {#if isAdmin}<TournamentForm
            onsaved={(tournament) => {
                void goto(`/tournaments/${tournament.id}`)
            }}
        />{:else}<p>Only site administrators can create tournaments.</p>{/if}
</main>
