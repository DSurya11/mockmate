import { preview } from 'vite';

const server = await preview({
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT || 4173,
    strictPort: false,
  },
});

server.printUrls();
