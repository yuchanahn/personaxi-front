<script lang="ts">
  import { base } from '$app/paths'
  //import { Viewer } from '$lib/vrm/viewer'

  let canvas: HTMLCanvasElement

  onMount(() => {
    //const viewer = new Viewer()
    //viewer.setup(canvas)
    //viewer.loadVrm(base + '/AvatarSample_B.vrm')
  })

</script>

<main>
  <div id="character-view">
    <canvas bind:this={canvas}></canvas>
  </div>
</main>