<script lang="ts">
    import ScalingWrapper from '../ScalingWrapper.svelte'
    let { maxScale = 1, scrollable = false }: { maxScale?: number; scrollable?: boolean } = $props()
    let clicks = $state(0)
</script>
<div data-testid="table-scroll" style="width:400px;overflow:auto">
<div style={scrollable ? 'width:800px;padding-left:400px' : ''}>
<div style="width:400px;height:300px">
    <ScalingWrapper controls="none" {maxScale}>
        <button data-testid="board" style="display:block;width:1000px;height:800px" onclick={() => clicks++}>Board</button>
    </ScalingWrapper>
</div>
</div>
</div>
<output>{clicks}</output>
