<script lang="ts">
    import RoundHistory from '../../../../libs/18xx-ui/src/lib/table/RoundHistory.svelte'
    import type { HistoryRound } from '../../../../libs/18xx-ui/src/lib/table/historyRounds.js'

    let { newestFirst = false }: { newestFirst?: boolean } = $props()
    let rounds: HistoryRound[] = $state([])
    let historyComplete = $state(false)
    function completeHistory() {
        rounds = Array.from({ length: 20 }, (_, index) => ({
            id: String(20 - index),
            label: `SR ${20 - index}`,
            phases: ['2'],
            entries: []
        }))
        historyComplete = true
    }
</script>

<div class="fixture">
    <button onclick={completeHistory}>Complete history</button>
    <button onclick={() => (rounds = [...rounds])}>Update history</button>
    <div class="panel">
        <RoundHistory
            {rounds}
            {newestFirst}
            {historyComplete}
            phaseColors={{ '2': '#ffffff' }}
            onJump={() => {}}
            onOrderChange={(first) => (newestFirst = first)}
        >
            {#snippet children(round)}
                <div style="height: 100px">Actions for {round.label}</div>
            {/snippet}
        </RoundHistory>
    </div>
</div>

<style>
    .fixture {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: white;
    }
    .panel {
        height: 300px;
        width: 400px;
    }
</style>
