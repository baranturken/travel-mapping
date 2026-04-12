# Map Rendering

## MVP behavior

- Convert saved stops into markers.
- Convert consecutive stops into straight-line legs.
- Attach a transport label or icon to each leg.
- Fit the map viewport around the full trip.
- Keep the rendering deterministic and fast on mobile.

## Why straight lines in v1

- They satisfy the product concept quickly.
- They avoid premature routing complexity.
- They make the first version easier to stabilize.

## Future behavior

- Replace straight lines with route-aware geometry for land and sea travel.
- Support map-first editing and drag interactions.
- Add richer overlays for photos, stays, and visited places.
