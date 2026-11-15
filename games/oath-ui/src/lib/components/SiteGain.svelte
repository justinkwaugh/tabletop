<script lang="ts">
    import type { SitePlayGain } from '@tabletop/oath'
    import TokenText from '$lib/components/TokenText.svelte'
    import { siteGainParts } from '$lib/model/siteGain.js'

    // R-5.1.4.I — after "To your site": what the play gains, gold, or "+0" in grey, its token dimmed with
    // it, when it gains nothing. The button's name says it in words.
    let { gain }: { gain: SitePlayGain } = $props()
</script>

<span class="inline-flex items-center gap-1.5" data-site-gain aria-hidden="true">
    {#each siteGainParts(gain) as part (part.text)}
        <span
            class="font-semibold {part.gains
                ? 'text-oath-accent'
                : 'text-oath-text-muted opacity-75'}"
            data-gains={part.gains}><TokenText text={part.text} /></span
        >
    {/each}
</span>
