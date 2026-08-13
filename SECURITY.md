# Security policy

## Reporting a vulnerability

Use GitHub's private security-advisory feature, or email
<eddie.pohjavirta@gmail.com>. Please do not open a public issue before a
maintainer has had a chance to assess the report.

## Scope

Shikaku is a static client-side application with no backend and no accounts.

The application code makes no network requests of its own. The service worker is
network-first and refetches the app's own shell assets, caching only same-origin
successful responses; it contacts no third party and sends no telemetry. Game
state is held in the browser's `localStorage` on the player's device and is never
transmitted.
