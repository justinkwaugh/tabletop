<script lang="ts">
    import { onMount, type ComponentProps } from 'svelte'
    import ScalingWrapper from '../ScalingWrapper.svelte'
    let { maxScale = 1, maxFitScale, scrollable = false, verticalBody = false, modal = false, expandable = false, overpan = 'none', gestureOverpanReach, coverBelowScale, renderAtViewScale = false, insetTop,
        boardWidth = 1000, boardHeight = 800, focus }:
        Pick<ComponentProps<typeof ScalingWrapper>, 'maxScale' | 'maxFitScale' | 'expandable' | 'overpan' | 'gestureOverpanReach' | 'coverBelowScale' | 'renderAtViewScale' | 'insetTop'> & {
            boardWidth?: number
            boardHeight?: number
            scrollable?: boolean
            verticalBody?: boolean
            modal?: boolean
            focus?: Parameters<ScalingWrapper['focusRect']>[0]
        } = $props()
    let clicks = $state(0)
    let dialog: HTMLDialogElement
    let wrapper: ScalingWrapper | undefined = $state()
    onMount(() => {
        if (modal) {
            dialog.showModal()
            wrapper?.focusRect({ x: 200, y: 200, width: 300, height: 200 })
        }
        if (focus) wrapper?.focusRect(focus)
    })
</script>
<dialog bind:this={dialog} open={!modal} style="margin:0;padding:0;border:0"><div data-testid="table-scroll" style="width:400px;overflow:auto">
<div style={scrollable ? 'width:800px;padding-left:400px' : ''}>
{#snippet pane()}<div data-testid="pane" style="width:400px;height:300px">
    <ScalingWrapper bind:this={wrapper} controls="none" {maxScale} {maxFitScale} {expandable} {overpan} {gestureOverpanReach} {coverBelowScale} {renderAtViewScale} {insetTop}>
        <button data-testid="board" style="display:block;width:{boardWidth}px;height:{boardHeight}px" onclick={() => clicks++}>Board</button>
    </ScalingWrapper>
</div>{/snippet}
{#if verticalBody}<div data-testid="body-scroll" style="height:300px;overflow:auto;overscroll-behavior-y:none">
    {@render pane()}<div style="height:300px"></div>
</div>{:else}{@render pane()}{/if}
</div>
</div>
<output>{clicks}</output><span data-testid="scale">{wrapper?.viewScale()}</span></dialog>
