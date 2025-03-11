<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const error = ref<Error | null>(null);
const errorInfo = ref<string>('');

// Capture errors from child components
onErrorCaptured((err, instance, info) => {
  error.value = err as Error;
  errorInfo.value = info;
  
  // Log the error
  console.error('Error captured by boundary:', err, info);
  
  // Prevent the error from propagating further
  return false;
});

// Reset the error state
const resetError = () => {
  error.value = null;
  errorInfo.value = '';
};
</script>

<template>
  <div>
    <!-- Show error UI if there's an error -->
    <div v-if="error" class="error-boundary p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <h2 class="text-lg font-bold mb-2">Something went wrong</h2>
      <p class="mb-2">{{ error.message }}</p>
      <details class="mb-4">
        <summary class="cursor-pointer">Technical Details</summary>
        <pre class="mt-2 p-2 bg-red-50 text-xs overflow-auto">{{ errorInfo }}</pre>
        <pre class="mt-2 p-2 bg-red-50 text-xs overflow-auto">{{ error.stack }}</pre>
      </details>
      <div class="flex space-x-2">
        <button 
          @click="resetError" 
          class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Try Again
        </button>
        <button 
          @click="() => window.location.reload()" 
          class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Reload Page
        </button>
      </div>
    </div>
    
    <!-- Render children if no error -->
    <slot v-else></slot>
  </div>
</template>

<style scoped>
.error-boundary {
  max-width: 800px;
  margin: 2rem auto;
}

pre {
  max-height: 300px;
}
</style>
