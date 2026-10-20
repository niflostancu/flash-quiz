<script setup lang="ts">
defineProps<{ path: string }>();
</script>

<template>
  <main class="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 class="text-2xl font-semibold error">Page not found</h1>
    <p class="text-muted">
      Nothing is served at
      <code class="rounded bg-black/5 px-1.5 py-0.5 text-sm">{{ path }}</code>
    </p>
    <a class="font-medium text-accent underline underline-offset-4" href="/">Go Back</a>
  </main>
</template>
