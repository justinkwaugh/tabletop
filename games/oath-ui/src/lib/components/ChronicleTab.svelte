<script lang="ts">
    import ChronicleEntryCard from '$lib/components/ChronicleEntryCard.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // The chronicle's record, newest first, like the History.
    let gameSession = getGameSession()
    let entries = $derived((gameSession.gameState.chronicleRecord ?? []).toReversed())
</script>

<div
    class="chronicle-tab flex h-full min-h-[300px] flex-col gap-2 overflow-auto rounded-lg border border-oath-frame bg-oath-surface p-2"
>
    {#each entries as entry (entry.gameNumber)}
        <ChronicleEntryCard {entry} />
    {/each}
</div>
