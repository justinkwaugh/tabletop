<script lang="ts">
    import LeagueDetailView from '$lib/components/leagues/LeagueDetailView.svelte'
    let { data }: { data: { id: string; season?: number } } = $props()
</script>

{#key `${data.id}:${data.season}`}<LeagueDetailView id={data.id} season={data.season} />{/key}
