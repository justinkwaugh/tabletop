<script lang="ts">
    let { id }: { id: string } = $props()
</script>

<!-- Deliberate: cast stack by stack. Over a whole layer of pieces the filter region spans the board, and every repaint blurs all of it. -->
<filter {id} x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#1c2a25" flood-opacity="0.38"
    ></feDropShadow>
</filter>
