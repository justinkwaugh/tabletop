<script lang="ts">
    import TitlePrompt from '../table/TitlePrompt.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { TrainlessMajorModule } from '../session/trainlessMajorModule.svelte.js'
    let {
        session,
        trainless,
        companyId,
        spacesPerLoan
    }: {
        session: EighteenXXSessionView
        trainless: TrainlessMajorModule
        companyId: string
        /** How many spaces the price falls for each loan still owed. */
        spacesPerLoan: number
    } = $props()
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const perLoan = $derived(
        spacesPerLoan === 1 ? 'a space lower again' : `${spacesPerLoan} spaces lower again`
    )
</script>

<TitlePrompt
    text="{session.companyName(
        companyId
    )} has no train as the phase begins. Nationalise it? Its loans are repaid from its treasury where they can be, and its shareholders are paid its price a space lower, and {perLoan} for each loan still owed."
>
    <button
        class="action-button inline-action"
        disabled={busy}
        onclick={() => trainless.decide(true)}>Nationalise</button
    >
    <button
        class="action-button inline-action"
        disabled={busy}
        onclick={() => trainless.decide(false)}>Keep</button
    >
</TitlePrompt>
