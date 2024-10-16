<script lang="ts">
    import { T } from '@threlte/core'
    import Hud from './Hud.svelte'
</script>

<T.OrthographicCamera makeDefault zoom={80} position={[0, 0, 10]} />
<T.AmbientLight intensity={1.5} />
<T.PointLight position={[10, 10, 10]} decay={0} intensity={1.5} />

<Hud />
