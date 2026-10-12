<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        yes,
        no,
        cost
    }: {
        yes: string
        no: string
        /** What the yes pays, in gold after its word ("1 secret"). */
        cost?: string
    } = $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let refused = $derived(draft.acceptRefusedBecause)
    const width = new ChoiceWidth()
</script>

<!-- The yes waits for its picks; a red line only when the engine refuses it as picked. -->
{#if refused}
    <p class="mb-2 text-[11px] text-oath-danger">
        <TokenText text={gameSession.humanizeReason(refused) ?? ''} />
    </p>
{/if}
<div class="flex flex-wrap gap-2">
    {#if draft.acceptComplete && !refused}
        <AnswerButton
            primary
            {width}
            disabled={busy}
            label={cost ? `${yes}, paying ${cost}` : undefined}
            onclick={() => draft.accept()}
        >
            {yes}{#if cost}<span aria-hidden="true">·</span><span class="text-oath-accent"
                    ><TokenText text={cost} /></span
                >{/if}
        </AnswerButton>
    {/if}
    <AnswerButton {width} disabled={busy} onclick={() => draft.decline()}>{no}</AnswerButton>
</div>
