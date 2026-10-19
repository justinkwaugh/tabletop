<script lang="ts">
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import CageWarbandRows from '$lib/components/CageWarbandRows.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import { cageQuestion } from '$lib/model/cagePlacement.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-10.13-H1 — Fae Merchant's second step: the Obsidian Cage goes down, and its Imperial
    // warbands go back to the Imperial boards its holder picks, in the Cage Action's own rows.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    const width = new ChoiceWidth()
</script>

<QuestionForm>
    {#snippet line()}{cageQuestion(draft.cageWarbands)}{/snippet}
    <div class="mb-2">
        <CageWarbandRows
            boards={draft.cageBoards}
            total={draft.cageWarbands}
            counts={draft.cageCounts}
            ceilingAt={(row) => draft.cageCeilingAt(row)}
            onpick={(row, count) => draft.setCageCount(row, count)}
        />
    </div>
    <div class="flex flex-wrap gap-2">
        <AnswerButton
            primary
            {width}
            disabled={busy || !draft.cageReturnReady}
            onclick={() => void draft.returnCage()}>Return them</AnswerButton
        >
    </div>
</QuestionForm>
