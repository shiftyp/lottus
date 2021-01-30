import { PrecacheController, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing'
import {
  NetworkFirst,
  CacheFirst,
} from 'workbox-strategies'

const precacheController = new PrecacheController()


// Used for filtering matches based on status code, header, or both
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
// Used to limit entries in cache, remove entries after a certain period of time
import { ExpirationPlugin } from 'workbox-expiration'

const defaultStrategy = new NetworkFirst({
  // Put all cached files in a cache named 'assets'
  cacheName: 'assets',
  plugins: [
    // Ensure that only requests that result in a 200 status are cached
    new CacheableResponsePlugin({
      statuses: [200],
    }),
  ],
})

const cacheStrategy = new CacheFirst({
  // Put all cached files in a cache named 'images'
  cacheName: 'images',
  plugins: [
    // Ensure that only requests that result in a 200 status are cached
    new CacheableResponsePlugin({
      statuses: [200],
    }),
    // Don't cache more than 50 items, and expire them after 30 days
    new ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
    }),
  ],
})

// SPA
setDefaultHandler((args) => {
  if (/(\.(js|css|map))$/.test(args.url.pathname)) {
    return defaultStrategy.handle(args)
  }
  if (/(\.(webp|gif|jp(e)?g|png|webmanifest))$/.test(args.url.pathname)) {
    return cacheStrategy.handle(args)
  }
  if (args.url.pathname === '/index.html') {
    return defaultStrategy.handle(args);
  }

  const url = new URL('/index.html', args.url.origin);

  return defaultStrategy.handle({ ...args, url })
})