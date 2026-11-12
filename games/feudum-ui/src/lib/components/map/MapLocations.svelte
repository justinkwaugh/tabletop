<script lang="ts">
    import { Spaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import { MapAsset, assetUrl } from '$lib/art/assetMap.js'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import {
        PlainChrome,
        dimmedUnlessAny,
        isPickable,
        type BoardChrome
    } from '$lib/model/boardChrome.js'
    import { feudumTarget, roleOf, spaceTarget } from '$lib/model/boardOffer.js'
    import { spaceLabel } from '$lib/model/cardFlows.js'
    import { DiscFrame, spaceGeometry } from '$lib/utils/boardGeometry.js'
    import BoardPiece from './BoardPiece.svelte'
    import PickChrome from './PickChrome.svelte'

    /**
     * R-1.2.1 Each space's disc, with the start ring in map ink. The letters are printed on
     * the map, so they are drawn only on our own terrain. A space's chrome stands on its disc: the
     * space itself, or the feudum there when the pick is of feudums. A disc with nothing lit on it
     * opens the card of what is there (contract: Site card).
     */
    let { state, chrome = PlainChrome }: { state: HydratedFeudumGameState; chrome?: BoardChrome } =
        $props()

    const RingFrame = DiscFrame + 10
    let drawnLetters = $derived(!assetUrl(MapAsset))
</script>

{#each Spaces as space (space.id)}
    {@const geometry = spaceGeometry(space.id)}
    {@const location = state.spaces[space.id].location}
    {@const onDisc = [spaceTarget(space.id), feudumTarget(space.id)]}
    <g opacity={dimmedUnlessAny(chrome, onDisc)}>
        <BoardPiece at={geometry.centre} piece="disc:{space.id}">
            <LocationDisc
                kind={location.kind}
                guild={location.feudumGuild}
                start={space.startingSpace}
                size={DiscFrame}
                x={-DiscFrame / 2}
                y={-DiscFrame / 2}
            />
        </BoardPiece>
    </g>
    {#if drawnLetters && space.letters.length > 0}
        <text
            x={geometry.letters.x}
            y={geometry.letters.y}
            text-anchor="middle"
            font-size="16"
            font-weight="700"
            fill="var(--feudum-map-ink)"
            data-letters={space.id}>{space.letters.join('')}</text
        >
    {/if}
    {#if chrome.openSite && !onDisc.some((target) => isPickable(roleOf(chrome.offer, target)))}
        <circle
            cx={geometry.centre.x}
            cy={geometry.centre.y}
            r={RingFrame / 2}
            fill="transparent"
            role="button"
            tabindex="0"
            aria-label="What is at {spaceLabel(space.id)}"
            pointer-events="all"
            cursor="pointer"
            data-open-site={space.id}
            onclick={() => chrome.openSite?.(space.id)}
            onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    chrome.openSite?.(space.id)
                }
            }}
            onpointerenter={(event) => {
                if (event.pointerType === 'mouse') {
                    chrome.hoverSite?.(space.id)
                }
            }}
            onpointerleave={() => chrome.hoverSite?.(undefined)}
        ></circle>
    {/if}
    {#each onDisc as target (target)}
        <PickChrome
            {target}
            {chrome}
            at={geometry.centre}
            width={RingFrame}
            label={spaceLabel(space.id)}
        />
    {/each}
{/each}
