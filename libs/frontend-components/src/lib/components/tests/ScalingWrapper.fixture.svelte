<script lang="ts">
    import ScalingWrapper from '../ScalingWrapper.svelte'
    let { maxScale = 1 }: { maxScale?: number } = $props()
    let clicks = $state(0)
</script>
<div style="width:400px;height:300px">
    <ScalingWrapper controls="none" {maxScale}>
        <button data-testid="board" style="display:block;width:1000px;height:800px" onclick={() => clicks++}>Board</button>
    </ScalingWrapper>
</div>
<output>{clicks}</output>
