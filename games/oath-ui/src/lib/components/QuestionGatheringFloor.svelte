<script lang="ts">
    import { GATHERING_ALLOWS } from '@tabletop/oath'
    import ExchangeEditor from '$lib/components/ExchangeEditor.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let me = $derived(gameSession.myPlayer)
</script>

<p class="text-sm mb-2">Your turn to propose one binding exchange with a player here, or pass.</p>
<label class="flex items-center gap-2 text-xs mb-2">
    with
    <select
        class="rounded bg-stone-800 px-1 py-0.5 grow"
        disabled={busy}
        value={draft.floorWith ?? ''}
        onchange={(e) => draft.chooseFloorWith(e.currentTarget.value || undefined)}
    >
        <option value="">nobody</option>
        {#each draft.floorCandidates as id (id)}
            <option value={id}>{gameSession.getPlayerName(id)}</option>
        {/each}
    </select>
</label>
{#if draft.floorWith && me}
    <ExchangeEditor
        proposerId={me.id}
        counterpartyId={draft.floorWith}
        allows={GATHERING_ALLOWS}
        value={draft.floorTerms}
        onchange={(terms) => draft.setFloorTerms(terms)}
    />
{/if}
<div class="mt-2">
    <QuestionYesNo yes="Propose" no="Pass" />
</div>
