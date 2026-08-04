<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/lowenherz'

    const gameSession = getGameSession()
    const actionState = $derived(gameSession.gameState)

    // Master switch for the testing/fast-forward shortcuts (auto-place castles, seed
    // regions, fast-forward to placement, deal politics cards). Flipped off so none of
    // them render, but all the markup below - and the gameSession methods it calls -
    // is kept intact so they can be brought back by setting this to true.
    const SHOW_TESTING_CONTROLS = false

    // ...except this one, which is independently switched on right now: dealing
    // everyone a random 1-5 cards is the only practical way to eyeball the hand-splay
    // layout (flat vs. overlapped, and the jitter that only kicks in once cards
    // overlap - see PlayerState.svelte) at every count.
    const SHOW_DEAL_POLITICS_CARDS = true

    const canFastForwardToActionEffect = $derived(
        actionState.machineState !== MachineState.PlacingCastles &&
            actionState.machineState !== MachineState.PlacingWalls &&
            actionState.machineState !== MachineState.PlacingKnights &&
            actionState.machineState !== MachineState.EndOfGame
    )
</script>

{#if SHOW_TESTING_CONTROLS}
<div class="flex flex-col gap-1">
    {#if !gameSession.setupComplete}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.autoPlaceAllCastles()}
        >
            Auto-place all castles (testing)
        </button>
    {:else}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.seedTestRegions()}
        >
            Seed regions for unclaimed castles (testing)
        </button>
    {/if}

    {#if canFastForwardToActionEffect}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.autoAdvanceToActionEffect()}
        >
            Fast-forward to wall/knight placement (testing)
        </button>
    {/if}

    {#if gameSession.setupComplete}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.giveTestPoliticsCards()}
        >
            Give Renegade + Alliance cards (testing)
        </button>
    {/if}
</div>
{/if}

{#if SHOW_DEAL_POLITICS_CARDS && gameSession.setupComplete}
    <div class="flex flex-col gap-1">
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.giveTestRandomPoliticsCards()}
        >
            Give 1-5 random politics cards to everyone (testing)
        </button>
    </div>
{/if}
