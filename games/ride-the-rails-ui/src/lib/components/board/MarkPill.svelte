<script lang="ts">
    import type { MarkTone } from '$lib/utils/pickMarks.js'

    let { tone, text }: { tone: MarkTone; text: string } = $props()

    const FILL: Readonly<Record<MarkTone, string>> = {
        coin: 'var(--rtr-coin)',
        five: 'var(--rtr-five)',
        gold: 'var(--rtr-gold)',
        cost: 'var(--rtr-cost)'
    }
</script>

<span
    class="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full border border-rtr-halo px-1.5 text-xs font-extrabold"
    style:background-color={FILL[tone]}
    style:color={tone === 'coin' ? 'var(--rtr-halo)' : 'var(--rtr-white)'}>{text}</span
>
