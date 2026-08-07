<script lang="ts">
    import { type Snippet } from 'svelte'
    import HistoryControls from './HistoryControls.svelte'
    import DefaultTabs from './DefaultTabs.svelte'

    let {
        history,
        playersPanel,
        chat
    }: {
        history?: Snippet
        playersPanel?: Snippet
        chat?: Snippet
    } = $props()
</script>

<div class="max-sm:hidden">
    <HistoryControls />
</div>
<DefaultTabs {history} {playersPanel} {chat} />
