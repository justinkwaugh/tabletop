<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { RepairsRowView } from '$lib/model/repairsRow.js'
    import type { WaitingView } from '$lib/model/waitingView.js'
    import ActionDescription from './ActionDescription.svelte'
    import RepairsRow from './RepairsRow.svelte'

    let { view, row }: { view: WaitingView; row: RepairsRowView | undefined } = $props()
</script>

<!-- Contract, "Watching": who decides and what, the shared step's live state, the last action. -->
<div data-waiting-view>
    <p class="text-[15px]" data-waiting-decider>
        {#if view.lead}<b class="pp-prompt">{view.lead}</b>{' '}{/if}<ActionDescription
            parts={view.parts}
        />
    </p>
    {#if row}
        <div class="mt-2">
            <RepairsRow {row} />
        </div>
    {/if}
    {#if view.last}
        <p class="pp-aside mt-1.5 text-[13px]" data-waiting-last>
            Last: <PlayerName playerId={view.last.playerId} />{' '}<ActionDescription
                parts={view.last.parts}
            />
        </p>
    {/if}
</div>
