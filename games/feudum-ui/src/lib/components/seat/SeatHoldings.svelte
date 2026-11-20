<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import LockMark from '$lib/components/pieces/LockMark.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatHoldingsItem } from '$lib/model/seatLines.js'
    import { writName } from '$lib/model/writLabels.js'

    /** R-4.4.4 Another seat's writs are a back and a count; R-3.1-H1 a pouch stays sealed. */
    let {
        items,
        paint,
        scale,
        pouchMotion
    }: {
        items: readonly SeatHoldingsItem[]
        paint: SeatPaint
        scale: number
        pouchMotion?: Attachment<HTMLElement>
    } = $props()

    const Piece = 15
    const WritWidth = 12
    const Tile = 17
    let piece = $derived(Piece * scale)
    let writWidth = $derived(WritWidth * scale)

    function pouchWords(item: Extract<SeatHoldingsItem, { item: 'pouch' }>): string {
        const { pouch } = item
        if (pouch.status === 'sealed') {
            return 'pouch: sealed'
        }
        return pouch.status === 'finalised'
            ? `pouch: ${pouch.good}, ${pouch.note}${pouch.spent ? ', spent' : ''}`
            : `pouch: ${pouch.good}, ${pouch.status === 'committed' ? 'sealed' : pouch.status}`
    }
</script>

<div
    class="line flex flex-wrap items-center gap-x-[0.5em] gap-y-[0.2em]"
    data-seat-line="holdings"
    data-seat-section="holdings"
>
    {#each items as entry, index (index)}
        {#if entry.item === 'markers'}
            <span
                class="flex items-center gap-[0.15em]"
                title="{entry.count} influence markers in supply"
                data-supply-markers={entry.count}
            >
                <SeatToken kind="marker" {paint} size={piece} />
                <span class:zero={entry.count === 0}>{entry.count}</span>
            </span>
        {:else if entry.item === 'discs'}
            <span
                class="flex items-center gap-[0.15em]"
                title="{entry.free} of {entry.of} discs free"
                data-supply-discs={entry.free}
            >
                <SeatToken kind="disc" {paint} size={piece} />
                {entry.free}/{entry.of}
            </span>
        {:else if entry.item === 'barrel'}
            {@const words = `wine barrel: ${entry.sulfur} of ${entry.capacity} sulfur`}
            <span
                class="flex items-center"
                title={words}
                data-seat-section="barrel"
                data-barrel={entry.sulfur}
            >
                <svg
                    width={piece * 0.9}
                    height={piece}
                    viewBox="0 0 18 20"
                    role="img"
                    aria-label={words}
                >
                    <title>{words}</title>
                    {#each Array.from({ length: entry.capacity }, (_, stave) => stave) as stave (stave)}
                        <rect
                            x={1 + stave * 5.5}
                            y="1"
                            width="5"
                            height="18"
                            rx="2"
                            fill={stave < entry.sulfur
                                ? 'var(--feudum-good-sulfur)'
                                : 'var(--feudum-parchment-shade)'}
                            stroke="var(--feudum-wood-dark)"
                            stroke-width="0.8"
                        ></rect>
                    {/each}
                    <line x1="0" y1="6" x2="18" y2="6" stroke="var(--feudum-wood-dark)"></line>
                    <line x1="0" y1="14" x2="18" y2="14" stroke="var(--feudum-wood-dark)"></line>
                </svg>
            </span>
        {:else if entry.item === 'writs'}
            {@const { writs, count } = entry}
            <span
                class="flex items-center gap-[0.15em]"
                title={writs.deckNote ?? `${count} ${count === 1 ? 'writ' : 'writs'}`}
                data-seat-section="writs"
                data-writ-count={count}
                data-deck-note={writs.deckNote}
            >
                {#if writs.backs > 0}
                    <Enlargeable
                        tag="div"
                        label="writ back"
                        face={() => ({ kind: 'writ', faceShown: false })}
                    >
                        <div data-writ-back="open">
                            <WritFace faceShown={false} width={writWidth} />
                        </div>
                    </Enlargeable>
                    {writs.backs}
                {/if}
                {#if writs.sealedBacks > 0}
                    <Enlargeable
                        tag="div"
                        label="sealed writ back"
                        face={() => ({ kind: 'writ', faceShown: false, sealed: true })}
                    >
                        <div data-writ-back="sealed">
                            <WritFace faceShown={false} sealed={true} width={writWidth} />
                        </div>
                    </Enlargeable>
                    {writs.sealedBacks}
                {/if}
                {#each writs.faces as writId (writId)}
                    <Enlargeable
                        tag="div"
                        label={writName(writId)}
                        face={() => ({ kind: 'writ', faceShown: true, writId })}
                    >
                        <div data-writ-face={writId}>
                            <WritFace faceShown={true} {writId} width={writWidth} />
                        </div>
                    </Enlargeable>
                {/each}
                {#each writs.sealedFaces as writId (writId)}
                    <Enlargeable
                        tag="div"
                        label="{writName(writId)}, sealed"
                        face={() => ({ kind: 'writ', faceShown: true, writId, sealed: true })}
                    >
                        <div data-writ-face={writId} data-writ-sealed>
                            <WritFace faceShown={true} {writId} sealed={true} width={writWidth} />
                        </div>
                    </Enlargeable>
                {/each}
                {#if count === 0}
                    <span class="zero flex items-center gap-[0.15em]">
                        <WritFace faceShown={false} width={writWidth} />0
                    </span>
                {:else if writs.faces.length + writs.sealedFaces.length > 0}
                    {count}
                {/if}
            </span>
        {:else if entry.item === 'tile'}
            {@const tile = entry.tile}
            <Enlargeable
                tag="div"
                label="{tile.landscape.replace('-', ' ')} tile"
                face={() => ({
                    kind: 'tile',
                    faceShown: true,
                    epoch: tile.epoch,
                    landscape: tile.landscape,
                    region: tile.region
                })}
            >
                <div data-supply-tile={tile.tileId}>
                    <TileFace
                        faceShown={true}
                        epoch={tile.epoch}
                        landscape={tile.landscape}
                        region={tile.region}
                        size={Tile * scale}
                    />
                </div>
            </Enlargeable>
        {:else if entry.item === 'vessel'}
            <span
                class="flex items-center gap-[0.15em]"
                title="{entry.count} {entry.vessel.replace('-', ' ')}"
                data-supply-vessel={entry.vessel}
            >
                <VesselToken vessel={entry.vessel} size={piece * 1.3} />
                {entry.count}
            </span>
        {:else}
            {@const pouch = entry.pouch}
            <!-- R-3.1-H1 At the reveal the state-change animator turns this over. -->
            <span class="flex" {@attach pouchMotion}>
                {#if pouch.status === 'sealed'}
                    <span
                        class="sealed flex items-center gap-[0.25em]"
                        title={pouchWords(entry)}
                        data-seat-section="pouch"
                        data-pouch="sealed"
                    >
                        <LockMark size={piece * 0.8} label="sealed" />
                    </span>
                {:else}
                    <span
                        class="flex items-center gap-[0.25em]"
                        class:spent={pouch.status === 'finalised' && pouch.spent}
                        title={pouchWords(entry)}
                        data-seat-section="pouch"
                        data-pouch={pouch.status}
                        data-pouch-good={pouch.good}
                        data-pouch-spent={pouch.status === 'finalised' && pouch.spent
                            ? ''
                            : undefined}
                    >
                        <span
                            class="flex"
                            class:drafted={pouch.status === 'drafted' ||
                                pouch.status === 'committed'}
                            ><GoodToken good={pouch.good} size={piece} /></span
                        >
                        {#if pouch.status === 'committed'}
                            <span class="sealed flex items-center"
                                ><LockMark size={piece * 0.8} label="sealed" /></span
                            >
                        {/if}
                    </span>
                {/if}
            </span>
        {/if}
    {/each}
</div>

<style>
    .zero {
        opacity: 0.45;
    }

    .spent {
        opacity: 0.4;
    }

    /* Contract, Seat panel: a drafted good stands in a solid ring, never a dashed one. */
    .drafted {
        outline: 1px solid var(--feudum-wood-dark);
        border-radius: 0.2em;
    }

    .sealed {
        color: var(--feudum-text-muted);
    }
</style>
