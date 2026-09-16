<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    let { name, color, title }: { name: string; color: string; title?: string } = $props()
    const textColor = $derived(contrastingTextColor(color))
</script>

<span class="train-badge" style:background={color} style:color={textColor} {title}>{name}</span>

<style>
    .train-badge {
        display: inline-block;
        padding: 0 4px;
        border-radius: 3px;
        color: #181818;
        filter: var(--rail-phase-filter, saturate(0.6));
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        white-space: nowrap;
    }
</style>
