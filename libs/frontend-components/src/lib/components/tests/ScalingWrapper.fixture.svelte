<script lang="ts">
    import { onMount } from 'svelte'
    import ScalingWrapper from '../ScalingWrapper.svelte'
    let { maxScale = 1, scrollable = false, modal = false, expandable = false }: { maxScale?: number; scrollable?: boolean; modal?: boolean; expandable?: boolean } = $props()
    let clicks = $state(0)
    let dialog: HTMLDialogElement
    let wrapper: ScalingWrapper
    onMount(() => {
        if (modal) {
            dialog.showModal()
            wrapper.focusRect({ x: 200, y: 200, width: 300, height: 200 })
        }
    })
</script>
<dialog bind:this={dialog} open={!modal} style="margin:0;padding:0;border:0"><div data-testid="table-scroll" style="width:400px;overflow:auto">
<div style={scrollable ? 'width:800px;padding-left:400px' : ''}>
<div style="width:400px;height:300px">
    <ScalingWrapper bind:this={wrapper} controls="none" {maxScale} {expandable}>
        <button data-testid="board" style="display:block;width:1000px;height:800px" onclick={() => clicks++}>Board</button>
    </ScalingWrapper>
</div>
</div>
</div>
<output>{clicks}</output></dialog>
