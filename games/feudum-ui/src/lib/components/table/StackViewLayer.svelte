<script lang="ts">
    import { stackTilesByEpoch } from '$lib/model/boardView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { StackViewOf } from '$lib/model/tableLayers.svelte.js'
    import EnlargedFaceView from './EnlargedFaceView.svelte'
    import Enlargeable from './Enlargeable.svelte'
    import Scrim from './Scrim.svelte'

    /**
     * A region stack's tiles by epoch, each a back (R-4.3.1). Reads the displayed state, so it works
     * in History View.
     */
    let { view, onClose }: { view: StackViewOf; onClose: () => void } = $props()

    const gameSession = getGameSession()
    const TileWidth = 96

    let state = $derived(gameSession.gameState)
    let region = $derived(view.region)
    let label = $derived(`the ${region} stack`)
    let groups = $derived(stackTilesByEpoch(state, region))
</script>

<Scrim {label} layer="stack" {onClose}>
    <div class="rounded-lg bg-feudum-surface-raised text-feudum-text p-6 pt-10 min-w-[280px]">
        {#if groups.length === 0}
            <p>Empty.</p>
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
    </div>
</Scrim>
