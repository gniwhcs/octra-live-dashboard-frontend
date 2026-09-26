# Octra Live Dashboard Frontend

Frontend-only source for the live Octra validator dashboard at `octra-node.exe.xyz`.

![Octra](static/logo.svg)

## Included

- Responsive dashboard markup
- Live validator, staking, lifetime rewards, account, transaction, host, and consensus UI
- CPU utilization chart
- OCT/USD price ticker
- Live reward freshness state and deployed source revision metadata
- Official Octra SVG logo and favicon

No validator keys, wallet files, databases, backend code, or node data are included.

## Files

```text
index.html
static/
  logo.svg
  script.js
  style.css
```

## Data source

The frontend requests `GET /api/snapshot` from the same origin every two seconds. A compatible backend must return the live snapshot consumed by `static/script.js`.

To use a separate API origin, update the URL in the `refresh()` function in `static/script.js` and configure CORS on that API.
