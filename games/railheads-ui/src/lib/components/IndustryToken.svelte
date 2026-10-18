<script lang="ts">
    import type { Industry } from '@tabletop/railheads'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryMark from './board/IndustryMark.svelte'

    let {
        industry,
        size = 22,
        labelled = false
    }: { industry: Industry; size?: number; labelled?: boolean } = $props()

    const style = $derived(INDUSTRY_STYLE[industry])
</script>

<span class="token" title="{style.name} token">
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
        <rect x="-11" y="-11" width="22" height="22" rx="3" fill="#ece6b8" stroke={style.ring} stroke-width="2.5" />
        <IndustryMark {industry} scale={0.62} />
    </svg>
    {#if labelled}<span>{style.name}</span>{/if}
</span>

<style>
    .token {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        vertical-align: middle;
    }
</style>
