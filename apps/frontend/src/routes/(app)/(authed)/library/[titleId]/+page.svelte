<script lang="ts">
    import GameTitlePage from '$lib/components/GameTitlePage.svelte'
    let { data } = $props()
</script>

{#key data.title.info.id}
    <GameTitlePage title={data.title} />
{/key}
