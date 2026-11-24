<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import type { RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { WritOffer } from '$lib/model/actionPanel.js'
    import Magnifier from './Magnifier.svelte'
    import RowChoice from './RowChoice.svelte'

    /** R-4.4.2, R-4.4.3, R-4.8.2 Each writ as a face, what it offers as buttons beneath. */
    let { offers, pointer }: { offers: readonly WritOffer[]; pointer: RowPointer } = $props()

    const FaceWidth = 110
</script>

<div class="flex w-full flex-wrap gap-2" data-writ-offers>
    {#each offers as offer (offer.writId)}
        <div
            class="flex flex-col gap-1"
            style:width="{FaceWidth * 1.6}px"
            data-writ-offer={offer.writId}
            role="group"
            aria-label={offer.name}
        >
            <div class="relative" style:width="{FaceWidth}px">
                <WritFace faceShown writId={offer.writId} width={FaceWidth} />
                <span class="absolute right-0 top-0">
                    <Magnifier
                        label={offer.name}
                        face={() => ({ kind: 'writ', faceShown: true, writId: offer.writId })}
                    />
                </span>
            </div>
            <div class="flex flex-wrap items-center gap-1">
                {#each offer.rows as row (row.choice.label)}
                    <RowChoice {row} {pointer} />
                {/each}
            </div>
        </div>
    {/each}
</div>
