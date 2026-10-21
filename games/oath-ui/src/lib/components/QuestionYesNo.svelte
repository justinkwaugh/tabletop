<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        yes,
        no,
        cost,
        dot = true,
        yesLabel
    }: {
        yes: string
        no: string
        /** What the yes pays, in gold after its word ("1 secret"). */
        cost?: string
        /** A dot between the word and its cost ("Travel · flip 1 secret"), or none ("Give 1 favor"). */
        dot?: boolean
        /** The yes read aloud, where "<yes>, paying <cost>" does not say it ("Travel and flip 1 secret"). */
        yesLabel?: string
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
            label={yesLabel ?? (cost ? `${yes}, paying ${cost}` : undefined)}
            onclick={() => draft.accept()}
        >
            {yes}{#if cost}{#if dot}<span aria-hidden="true">·</span>{/if}<span
                    class="text-oath-accent"><TokenText text={cost} /></span
                >{/if}
        </AnswerButton>
    {/if}
    <AnswerButton {width} disabled={busy} onclick={() => draft.decline()}>{no}</AnswerButton>
</div>
