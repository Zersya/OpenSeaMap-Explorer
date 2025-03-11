#!/bin/bash
# Install required dependencies
bun add leaflet @types/leaflet
bun add uuid @types/uuid
bun add @headlessui/vue
bun add axios
bun add pinia
bun add -D tailwindcss@3.4.1 postcss autoprefixer
bun add -D @tailwindcss/forms

# Initialize TailwindCSS if config doesn't exist
if [ ! -f "tailwind.config.js" ]; then
  npx tailwindcss init -p
fi
