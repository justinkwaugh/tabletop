<script lang="ts">
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import type { Session1861 } from './session.svelte.js'
    let { session, companyId }: { session: Session1861; companyId: string } = $props()
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<TitlePrompt
    text="{session.companyName(
        companyId
    )} has no train as the phase begins. Nationalise it? Its loans are repaid from its treasury where they can be, and its shareholders are paid its price a space lower, and a space lower again for each loan still owed."
>
    <button
        class="action-button inline-action"
        disabled={busy}
        onclick={() => session.decideTrainless(true)}>Nationalise</button
    >
    <button
        class="action-button inline-action"
        disabled={busy}
        onclick={() => session.decideTrainless(false)}>Keep</button
    >
</TitlePrompt>
