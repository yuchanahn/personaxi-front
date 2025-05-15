<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { test } from '$lib/vrm/test';

  let canvas: HTMLCanvasElement;

  onMount(async () => {
    try {
      test(canvas);
    } catch (error) {
      console.error('Error loading VRM:', error);
    }
  });
</script>

<div id="character-view">
  <canvas bind:this={canvas} class="vrm-canvas" />
</div>

<style>
  #character-view {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    z-index: 5;
  }

  .vrm-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
