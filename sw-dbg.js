const CACHE_NAME = "our-adventure-map-v1";
const urlsToCache = [
  "./index.html"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", function (event) {
  var url = event.request.url;

  // Don't intercept UI5 framework resources, external CDNs, or the OData backend —
  // only handle requests for our own app's index.html
  if (url.indexOf("/resources/") !== -1 ||
      url.indexOf("unpkg.com") !== -1 ||
      url.indexOf("fonts.googleapis.com") !== -1 ||
      url.indexOf("fonts.gstatic.com") !== -1 ||
      url.indexOf("/sap/opu/odata") !== -1) {
    return; // let the browser handle it normally, no interception
  }

  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (name) {
          return name !== CACHE_NAME;
        }).map(function (name) {
          return caches.delete(name);
        })
      );
    })
  );
});