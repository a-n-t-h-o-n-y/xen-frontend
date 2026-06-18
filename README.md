# XenSequencer Frontend

Vite, React, and TypeScript frontend for the XenSequencer JUCE WebView.

## Development with the standalone

The debug standalone loads the frontend from `http://127.0.0.1:5173`. Start
Vite from this repository before launching the standalone:

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

In another terminal, launch the debug standalone:

```bash
../XenSequencer/build/XenSequencer_artefacts/Debug/Standalone/XenSequencer
```

`--strictPort` prevents Vite from silently selecting another port when `5173`
is unavailable. The standalone only checks its configured dev-server URLs.

The frontend must run inside the standalone's JUCE WebView for native bridge
features to work. Opening the Vite URL in a regular browser does not provide
`window.__JUCE__`.

## Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run preview
```

Run `npm run lint && npm run build` before submitting changes.
