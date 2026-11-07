<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import { deckView, stackTilesByEpoch } from '$lib/model/boardView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { StackViewOf } from '$lib/model/tableLayers.svelte.js'
    import { writName } from '$lib/model/writLabels.js'
    import EnlargedFaceView from './EnlargedFaceView.svelte'
    import Enlargeable from './Enlargeable.svelte'
    import Scrim from './Scrim.svelte'

    /**
     * A region stack's tiles by epoch, each a back (R-4.3.1), or the deck's count and the writs the
     * table saw go under it (R-4.4.2). Reads the displayed state, so it works in History View.
     */
    let { view, onClose }: { view: StackViewOf; onClose: () => void } = $props()

    const gameSession = getGameSession()
    const TileWidth = 96
    const WritWidth = 120

    let state = $derived(gameSession.gameState)
    let label = $derived(view.kind === 'region' ? `the ${view.region} stack` : 'the writ deck')
</script>

<Scrim {label} layer="stack" {onClose}>
    <div class="rounded-lg bg-feudum-surface-raised text-feudum-text p-6 pt-10 min-w-[280px]">
        {#if view.kind === 'region'}
            {@const region = view.region}
            {@const groups = stackTilesByEpoch(state, region)}
            {#if groups.length === 0}
                <p>This stack is empty.</p>
            {/if}
            <div class="flex flex-wrap gap-4" data-stack-view={region}>
                {#each groups as { epoch, count } (epoch)}
                    <div class="flex flex-col items-center gap-1" data-stack-epoch={epoch}>
                        <Enlargeable
                            tag="div"
                            label="tile back"
                            face={() => ({ kind: 'tile', faceShown: false, epoch, region })}
                        >
                            <EnlargedFaceView
                                face={{ kind: 'tile', faceShown: false, epoch, region }}
                                width={TileWidth}
                            />
                        </Enlargeable>
                        <span>× {count}</span>
                    </div>
                {/each}
            </div>
        {:else}
            {@const deck = deckView(state, gameSession.myPlayerId)}
            <p class="mb-3" data-deck-count={deck.count}>{deck.count} writs</p>
            <div class="flex flex-wrap gap-3" data-deck-seen>
                {#each deck.seen as writId (writId)}
                    <Enlargeable
                        tag="div"
                        label={writName(writId)}
                        face={() => ({ kind: 'writ', faceShown: true, writId })}
                    >
                        <WritFace faceShown={true} {writId} width={WritWidth} />
                    </Enlargeable>
                {/each}
            </div>
        {/if}
    </div>
</Scrim>
