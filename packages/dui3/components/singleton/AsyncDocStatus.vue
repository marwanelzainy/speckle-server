<template>
  <div
    aria-live="assertive"
    class="pointer-events-none fixed inset-0 flex items-end px-4 py-12 mt-10 sm:items-start sm:p-6 z-50"
  >
    <div
      v-for="[key, modelCardProgress] in Object.entries(store.asyncDocProgress)"
      :key="key"
      class="pointer-events-auto w-full max-w-[20rem] overflow-hidden rounded-lg bg-foundation text-foreground shadow-lg ring-1 ring-primary-muted ring-opacity-5"
    >
      <CommonLoadingProgressBar
        :loading="!!modelCardProgress"
        :cancelled="modelCardProgress?.status === 'Cancelled'"
        :progress="modelCardProgress ? modelCardProgress.progress : undefined"
      />
      <div class="text-xs font-bold px-2 py-2 h-full flex items-center text-primary">
        {{ modelCardProgress?.status || '...' }}
        {{
          modelCardProgress?.progress
            ? ((modelCardProgress?.progress as number) * 100).toFixed() + '%'
            : ''
        }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHostAppStore } from '~/store/hostApp'

const store = useHostAppStore()
</script>
