<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import { writName } from '$lib/model/writLabels.js'
    import type { SeatWrits } from '$lib/model/seatPanel.js'

    /**
     * R-4.4.3, R-4.4.4 Contract, Seat panel: backs for another seat, one per writ, a sealed charter's
     * with its wax seal. The owner sees faces, sealed charters' dimmed, and what lies under the deck.
     */
    let { writs, scale }: { writs: SeatWrits; scale: number } = $props()

    const WritWidth = 34
    let width = $derived(WritWidth * scale)
    let count = $derived(
        writs.backs + writs.sealedBacks + writs.faces.length + writs.sealedFaces.length
    )
    // Backs carry no id, so nothing tells them apart: their place is their key.
    let backs = $derived(Array.from({ length: writs.backs }, (_, index) => index))
    let sealedBacks = $derived(Array.from({ length: writs.sealedBacks }, (_, index) => index))
</script>

<section class="flex flex-col gap-[0.25em]" data-seat-section="writs" data-writ-count={count}>
    <div class="flex flex-wrap items-center gap-[0.3em]">
        <span class="caption">Writs {count}</span>
        {#each backs as back (back)}
            <Enlargeable
                tag="div"
                label="writ back"
                face={() => ({ kind: 'writ', faceShown: false })}
            >
                <div data-writ-back="open">
                    <WritFace faceShown={false} {width} />
                </div>
            </Enlargeable>
        {/each}
        {#each sealedBacks as back (back)}
            <Enlargeable
                tag="div"
                label="sealed writ back"
                face={() => ({ kind: 'writ', faceShown: false, sealed: true })}
            >
                <div data-writ-back="sealed">
                    <WritFace faceShown={false} sealed={true} {width} />
                </div>
            </Enlargeable>
        {/each}
        {#each writs.faces as writId (writId)}
            <Enlargeable
                tag="div"
                label={writName(writId)}
                face={() => ({ kind: 'writ', faceShown: true, writId })}
            >
                <div data-writ-face={writId}>
                    <WritFace faceShown={true} {writId} {width} />
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
                    <WritFace faceShown={true} {writId} sealed={true} {width} />
                </div>
            </Enlargeable>
        {/each}
    </div>
    {#if writs.deckNote}
        <p class="italic" data-deck-note>{writs.deckNote}</p>
    {/if}
</section>

<style>
    .caption {
        font-style: italic;
        color: var(--feudum-wood-dark);
    }
</style>
