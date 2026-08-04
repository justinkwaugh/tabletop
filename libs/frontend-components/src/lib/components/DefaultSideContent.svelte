<script lang="ts">
    import { type Snippet } from 'svelte'
    import HistoryControls from './HistoryControls.svelte'
    import DefaultTabs from './DefaultTabs.svelte'

    let {
        history,
        playersPanel,
        chat,
        historyControlsEnabledColor,
        historyControlsDisabledColor,
        tabsFontClass,
        tabsActiveClass,
        tabsInactiveClass
    }: {
        history?: Snippet
        playersPanel?: Snippet
        chat?: Snippet
        historyControlsEnabledColor?: string
        historyControlsDisabledColor?: string
        tabsFontClass?: string
        tabsActiveClass?: string
        tabsInactiveClass?: string
    } = $props()
</script>

<div class="max-sm:hidden">
    <HistoryControls
        enabledColor={historyControlsEnabledColor}
        disabledColor={historyControlsDisabledColor}
    />
</div>
<DefaultTabs
    {history}
    {playersPanel}
    {chat}
    fontClass={tabsFontClass}
    activeTabClass={tabsActiveClass}
    inactiveTabClass={tabsInactiveClass}
/>
