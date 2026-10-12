<script lang="ts">
    import { GATHERING_ALLOWS } from '@tabletop/oath'
    import ExchangeEditor from '$lib/components/ExchangeEditor.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import PlayerChips from '$lib/components/PlayerChips.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let me = $derived(gameSession.myPlayer)
</script>

<div class="mb-2">
    <PlayerChips
        label="With:"
        playerIds={draft.floorCandidates}
        picked={draft.floorWith ? [draft.floorWith] : []}
        onpick={(id, wasPicked) => draft.chooseFloorWith(wasPicked ? undefined : id)}
        {busy}
    />
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
