<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let options = $derived(
        [
            gameSession.canMove ? 'click a fountain to move its visitors' : undefined,
            gameSession.canAuction ? 'click an unowned shop to auction it' : undefined
        ].filter((option) => option !== undefined)
    )
</script>

{#if gameSession.selectedFountainId === undefined}
    <p class="font-semibold">Your turn: {options.join(', or ')}.</p>
{:else}
    <div class="flex items-center justify-center gap-4">
        <p class="font-semibold">
            Choose where the visitors at fountain {gameSession.selectedFountainId} go.
        </p>
        <button
            class="rounded-md border border-[#8a6a46] px-3 py-1 text-sm"
            onclick={() => gameSession.back()}>Back</button
        >
    </div>
{/if}
