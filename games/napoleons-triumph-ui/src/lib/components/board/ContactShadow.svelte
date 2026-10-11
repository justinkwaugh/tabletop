<script lang="ts">
    let { id }: { id: string } = $props()
</script>

<filter {id} x="-5%" y="-5%" width="110%" height="110%">
    <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#1c2a25" flood-opacity="0.38"
    ></feDropShadow>
</filter>
