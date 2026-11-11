<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARK_PAPER } from '$lib/utils/approachSymbols.js'
    import StarMark from '../StarMark.svelte'
    import { STAR_TAG_PITCH, STAR_TAG_STAR_SIZE, starTagSize } from '$lib/utils/starTags.js'

    const gameSession = getGameSession()

    const LINE_WIDTH = 1.1

    const scale = $derived(gameSession.flagView.scale)
</script>

<g class="pointer-events-none">
    {#each gameSession.starTags as tag (tag.locale)}
        {@const { x, y } = tag.centre}
        {@const size = starTagSize(tag.stars.length)}
        {@const top = (-(tag.stars.length - 1) * STAR_TAG_PITCH) / 2}
        <g
            transform="translate({x} {y}) scale({scale})"
            data-star-tag={tag.locale}
            data-moved={tag.moved ? '' : undefined}
        >
            <rect
                x={-size.width / 2}
                y={-size.height / 2}
                width={size.width}
                height={size.height}
                fill={MARK_PAPER}
            ></rect>
            {#each tag.stars as { star, hold }, index (star)}
                <g
                    transform="translate(0 {top +
                        index *
                            STAR_TAG_PITCH}) rotate({-gameSession.boardRotation}) scale({STAR_TAG_STAR_SIZE /
                        2})"
                >
                    <StarMark {star} {hold} strokeWidth={LINE_WIDTH / (STAR_TAG_STAR_SIZE / 2)} />
                </g>
            {/each}
        </g>
    {/each}
</g>
