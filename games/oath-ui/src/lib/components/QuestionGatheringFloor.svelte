<script lang="ts">
    import { GATHERING_ALLOWS } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import ExchangeEditor from '$lib/components/ExchangeEditor.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let me = $derived(gameSession.myPlayer)
</script>

<!-- A player is their chip: a tap picks them, a second tap drops them. -->
<div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
    <span class="text-oath-text-muted">With:</span>
    {#each draft.floorCandidates as id (id)}
        <button
            type="button"
            class="rounded p-0.5 text-sm max-sm:min-h-11 {draft.floorWith === id
                ? 'ring-2 ring-oath-accent'
                : 'ring-1 ring-transparent hover:ring-oath-accent'}"
            aria-pressed={draft.floorWith === id}
            disabled={busy}
            onclick={() => draft.chooseFloorWith(draft.floorWith === id ? undefined : id)}
        >
            <PlayerName playerId={id} />
        </button>
    {/each}
</div>
{#if draft.floorWith && me}
    <div class="mb-2">
        <ExchangeEditor
            proposerId={me.id}
            counterpartyId={draft.floorWith}
            allows={GATHERING_ALLOWS}
            value={draft.floorTerms}
            onchange={(terms) => draft.setFloorTerms(terms)}
        />
    </div>
{/if}
<QuestionYesNo yes="Propose" no="Pass" />
