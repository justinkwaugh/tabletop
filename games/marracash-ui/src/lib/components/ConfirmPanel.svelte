<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import UndoButton from '$lib/components/UndoButton.svelte'

    const gameSession = getGameSession()
</script>

<div class="flex flex-wrap items-center justify-center gap-4">
    <p class="font-semibold">Confirm your turn, or undo.</p>
    <button
        class="rounded-md bg-[#8a6a46] px-3 py-1 text-sm font-semibold text-white"
        disabled={gameSession.busy}
        onclick={() => gameSession.confirmTurn()}>Confirm turn</button
    >
    <UndoButton />
</div>
