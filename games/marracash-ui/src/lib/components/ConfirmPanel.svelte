<script lang="ts">
    import type { Snippet } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()
</script>

<div class="flex flex-wrap items-center justify-center gap-4">
    <p class="font-semibold">{@render lead?.()}Confirm your turn.</p>
    <button
        class="rounded-md bg-[#8a6a46] px-3 py-1 text-sm font-semibold text-white hover:bg-[#765a3b]"
        disabled={gameSession.busy}
        onclick={() => gameSession.confirmTurn()}>Confirm turn</button
    >
</div>
