<script lang="ts">
    import { centredTextShift } from '../presentation/textBaseline.js'
    let { label, title }: { label: string; title: string } = $props()
    // A longer label, such as P3, widens the disc into a pill.
    const width = $derived(Math.max(14, label.length * 6 + 4))
</script>

<span class="certificate-badge" class:wide={label.length > 1} role="img" aria-label={title} {title}>
    <svg {width} height="14" viewBox={`0 0 ${width} 14`} aria-hidden="true">
        <text x={width / 2} y="7" dy={centredTextShift(9)} font-size="9" text-anchor="middle"
            >{label}</text
        >
    </svg>
</span>

<style>
    .certificate-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 12px;
        height: 12px;
        margin-left: 4px;
        border: 1px solid var(--certificate-badge-background, var(--rail-solid, #695540));
        border-radius: 50%;
        background: var(--certificate-badge-background, var(--rail-solid, #695540));
        color: var(--rail-text, #fffaf4);
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        vertical-align: -3px;
    }
    .certificate-badge.wide {
        width: auto;
        padding: 0 1px;
        border-radius: 7px;
    }
    svg {
        flex-shrink: 0;
    }
    text {
        fill: currentColor;
    }
</style>
