<script lang="ts">
    import TournamentDetailView from '$lib/components/tournaments/TournamentDetailView.svelte'
    let { data }: { data: { id: string } } = $props()
</script>

{#key data.id}<TournamentDetailView id={data.id} />{/key}
