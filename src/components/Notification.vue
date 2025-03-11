<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isVisible = ref(props.show);

// Watch for changes in the show prop
watch(() => props.show, (newValue) => {
  isVisible.value = newValue;
  
  if (newValue && props.duration) {
    setTimeout(() => {
      close();
    }, props.duration);
  }
});

// Close the notification
const close = () => {
  isVisible.value = false;
  emit('close');
};

// Get background color based on type
const bgColor = () => {
  switch (props.type) {
    case 'success':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'info':
    default:
      return 'bg-sea-blue';
  }
};
</script>

<template>
  <Transition name="notification">
    <div 
      v-if="isVisible" 
      :class="[
        'fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white z-50 max-w-md',
        bgColor()
      ]"
      role="alert"
      aria-live="polite"
    >
      <div class="flex items-center justify-between">
        <div>{{ message }}</div>
        <button 
          @click="close" 
          class="ml-4 text-white hover:text-gray-200 focus:outline-none"
          aria-label="Close notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  transform: translateY(30px);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100px);
  opacity: 0;
}
</style>
