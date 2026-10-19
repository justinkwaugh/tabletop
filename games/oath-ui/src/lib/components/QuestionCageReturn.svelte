<script lang="ts">
    import { IMPERIAL_WARBANDS, type WarbandGroup } from '@tabletop/oath'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import WarbandGroupRows from '$lib/components/WarbandGroupRows.svelte'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-10.13-H1 — Fae Merchant's second step: the Obsidian Cage goes down, and its Imperial
    // warbands go back to the Imperial boards its holder picks, in the Cage Action's own rows.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let total = $derived(draft.cageWarbands)
    let groups: WarbandGroup[] = $derived(
        draft.cageBoards.map((playerId) => ({
            at: { kind: 'board', playerId },
            owner: IMPERIAL_WARBANDS,
            count: total
        }))
    )
    const width = new ChoiceWidth()
</script>

<QuestionForm>
    {#snippet line()}Obsidian Cage: where {total === 1
            ? 'does its 1 purple warband go'
            : `do its ${total} purple warbands go`}?{/snippet}
    <div class="mb-2">
        <WarbandGroupRows
            {groups}
            counts={draft.cageCounts}
            ceilingAt={(row) => draft.cageCeilingAt(row)}
            onpick={(row, count) => draft.setCageCount(row, count)}
            tone="gold"
            toward
            ownerWord={false}
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
