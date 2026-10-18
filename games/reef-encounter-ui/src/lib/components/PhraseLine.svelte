<script lang="ts">
    import { capitalised, type Phrase, type PhrasePart } from '$lib/utils/actionDescription.js'
    import { PolypFaces } from '$lib/images/art.generated.js'
    import LarvaCube from './table/LarvaCube.svelte'
    import AlgaCylinder from './table/AlgaCylinder.svelte'
    import ParrotfishIcon from './ParrotfishIcon.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { phrase, capitalise = false }: { phrase: Phrase; capitalise?: boolean } = $props()

    const gameSession = getGameSession()
    const fishPaint = $derived(
        phrase.playerId ? gameSession.colors.getPlayerBgColorValue(phrase.playerId) : '#5aa58a'
    )

    // Lines show like a log, without the sentence's closing full stop.
    function words(part: PhrasePart, index: number): string {
        let shown = typeof part === 'string' ? part : 'icon' in part ? '' : part.short
        if (index === phrase.parts.length - 1) shown = shown.replace(/\.$/, '')
        return capitalise && index === 0 ? capitalised(shown) : shown
    }
</script>

<span class="sr-only">{capitalise ? capitalised(phrase.text) : phrase.text}</span>
<span class="line" aria-hidden="true">
    {#each phrase.parts as part, index (index)}
        {#if typeof part === 'string' || !('icon' in part)}
            {words(part, index)}
        {:else if part.icon === 'polyp'}
            <span class="icon polyp" class:reef-bitten={part.consumed} title={part.label}>
                <img src={PolypFaces[part.color][0].url} alt="" width="20" height="20" />
                {#if part.count > 1}<span class="times">×{part.count}</span>{/if}
            </span>
        {:else if part.icon === 'unseen-polyp'}
            <span class="icon unseen" title="a polyp, unseen">?</span>
        {:else if part.icon === 'cube'}
            <span class="icon" title={part.label}>
                {#each { length: Math.min(part.count, 2) } as _, cubeIndex (cubeIndex)}
                    <svg width="16" height="18" viewBox="-8 -9 16 18">
                        <LarvaCube center={{ x: 0, y: 0 }} size={15} color={part.color} />
                    </svg>
                {/each}
            </span>
        {:else if part.icon === 'cylinder'}
            <span class="icon" title={part.label}>
                <svg width="16" height="20" viewBox="-8 -10 16 20">
                    <AlgaCylinder center={{ x: 0, y: 0 }} size={14} color={part.alga} />
                </svg>
            </span>
        {:else if part.icon === 'parrotfish'}
            <span class="icon" title={part.label}>
                <ParrotfishIcon paint={fishPaint} />
            </span>
        {/if}
    {/each}
</span>

<style>
    .line {
        white-space: normal;
    }

    .icon {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        vertical-align: -4px;
    }

    /* A faint halo keeps dark pieces readable on dark glass. */
    svg {
        filter: drop-shadow(0 0 1.5px rgb(255 255 255 / 0.55));
    }

    .polyp img {
        border-radius: 3px;
        box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
    }

    .times {
        font-family: 'Reef Fredoka', sans-serif;
        font-weight: 600;
        font-size: 0.85em;
        font-variant-numeric: tabular-nums;
    }

    .unseen {
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 3px;
        background: repeating-linear-gradient(135deg, #6e7d78 0 3px, #5d6b66 3px 6px);
        box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
        color: #fff;
        font-family: 'Reef Fredoka', sans-serif;
        font-weight: 600;
        font-size: 13px;
    }
</style>
