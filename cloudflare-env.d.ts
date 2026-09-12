declare module 'cloudflare:workers' {
  export const env: import('./server/storage').Bindings;
}
