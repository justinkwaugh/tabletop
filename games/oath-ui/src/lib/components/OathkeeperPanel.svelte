<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { oathkeeperTileImage } from '$lib/images/tileImages.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import WaitingOn from '$lib/components/WaitingOn.svelte'

    // R-2.11.b, R-2.11-H1 — opens on anyone's turn; the candidates are exactly the tied players.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let busy = $derived(gameSession.busy)

    let pending = $derived(gameState.pendingOathkeeperChoice)
    let isMine = $derived(
        !!gameSession.myPlayer && pending?.holderPlayerId === gameSession.myPlayer.id
    )

    const TITLE = 'the Oathkeeper title'
    const title = oathkeeperTileImage(false)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">Oathkeeper</h3>

    {#if !pending}
        <p class="text-sm text-oath-text-muted">No title is waiting to be settled.</p>
    {:else if !isMine}
        <WaitingOn />
    {:else}
        <div class="flex items-start gap-3">
            <img
                class="shrink-0 cursor-zoom-in rounded"
                src={title}
                width="80"
                height="28"
                alt={TITLE}
                use:inspectImage={{ preview: { imageSrc: title, aspect: 80 / 28, label: TITLE } }}
            />
            <div class="min-w-0">
                <p class="mb-2 text-base">Who takes the title?</p>
                <div
                    class="inline-grid auto-cols-fr grid-flow-col gap-2 max-sm:flex max-sm:flex-wrap"
                >
                    {#each pending.candidates as candidateId (candidateId)}
                        <button
                            class="rounded border border-oath-frame bg-oath-surface px-4 py-1.5 hover:border-oath-accent disabled:opacity-40 max-sm:min-h-11 max-sm:min-w-24"
                            aria-label="Give it to {gameSession.getPlayerName(candidateId)}"
                            disabled={busy}
                            onclick={() => gameSession.resolveOathkeeper(candidateId)}
                        >
                            <PlayerName playerId={candidateId} />
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>
