<script lang="ts">
    import { goalCardImage } from '$lib/images/tileImages.js'
    import { oathName } from '$lib/model/names.js'
    import { oathkeeperGoalWords } from '$lib/model/chronicleHistory.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-8.1, R-2.11 — each Oath is the top half of its goal card, which prints the Oathkeeper goal;
    // this game's Oath is not among them. A tap rings one in gold, and Confirm appears once one is
    // picked.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.oathPick)
    let busy = $derived(gameSession.busy)
    let picked = $derived(draft.picked)
</script>

<div class="mb-2 flex flex-wrap gap-2">
    {#each draft.oaths as oathType (oathType)}
        {@const on = picked === oathType}
        <button
            type="button"
            class="rounded-[5px] disabled:opacity-40 {on
                ? 'ring-2 ring-oath-accent'
                : 'ring-1 ring-oath-control-hover hover:ring-oath-accent'}"
            aria-label="Oath of {oathName(oathType)}: {oathkeeperGoalWords(oathType)}"
            aria-pressed={on}
            disabled={busy}
            onclick={() => draft.pick(oathType)}
        >
            <img class="goal-top rounded-[4px] shadow-md" src={goalCardImage(oathType)} alt="" />
        </button>
    {/each}
</div>
<p class="text-sm">Choose the Oath.</p>
{#if picked !== undefined}
    <div class="mt-2 flex flex-wrap gap-2">
        <button
            type="button"
            class="shrink-0 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                   border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
            disabled={busy}
            onclick={() => draft.confirm()}
        >
            Confirm
        </button>
    </div>
{/if}

<style>
    /* The goal card's top half, the Oathkeeper goal, as legible as the card at this size; two to
       a line on a phone. */
    .goal-top {
        width: 136px;
        height: 100px;
        object-fit: cover;
        object-position: top;
    }
</style>
