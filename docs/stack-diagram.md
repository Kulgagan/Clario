# MUSYNC Stack Diagram

Mermaid source and PNG export for the app stack (client/server, runtime only � no offline datasets).

```mermaid
%% Source mirrors docs/stack-diagram.mmd
flowchart LR

  subgraph Client[Client / Frontend]
    A1[Muse 2\nEEG via BLE] --> A2[Connect Page\nPermissions]
    A2 --> A3[Session UI\nReact + shadcn/ui]
    A3 --> A4[Focus Meter\nCharts/Visualizer]
    A9[AudioWorklet\nPCM Player] --> A10[Speakers]
  end

  subgraph Server[Server / Audio + Policy]
    B1[EEG Stream Ingest] --> B2[Preprocess\nFilter + Gate Artifacts]
    B2 --> B3[Features\nBandpower + Alpha/Beta]
    B3 --> B4[Focus Estimator\nSmoothing]
    B6[RL/Policy Engine\nKeep + Explore + Transition]
    B7[Audio Generator\nMotif + Params]
    B8[PCM Streamer\nWebSocket]
  end

  C1[Questionnaire] --> C2[Profile + Overrides]
  C2 --> B6

  A1 -->|calibration and runtime| B1
  A3 -->|focus 0..100 every 750ms| B6
  B4 -->|focus %| A4
  B6 --> B7 --> B8 --> A9

  A3 -.skip/volume/pause.-> B8

  A3 -. start relax/task .-> B4
  B4 -. update midpoint .-> A4

  subgraph Legend
    L1[Green arrows = Inference]
    L2[Dashed arrows = Calibration Controls]
  end
```

Preferred (crisp):
- ![MUSYNC Stack (SVG)](stack-diagram.svg)

PNG export (hi‑res):
- ![MUSYNC Stack (PNG)](stack-diagram.png)

Export locally
- Quick PNG (hi‑res): `cd app/frontend && npx -y @mermaid-js/mermaid-cli@^10.9.1 -i ../../docs/stack-diagram.mmd -o ../../docs/stack-diagram.png -w 2400 -H 1600 -b white`
- Quick SVG (sharp at any zoom): `cd app/frontend && npx -y @mermaid-js/mermaid-cli@^10.9.1 -i ../../docs/stack-diagram.mmd -o ../../docs/stack-diagram.svg`
- With scripts: install once `npm i -D @mermaid-js/mermaid-cli` in `app/frontend`, then:
  - `npm run diagram:stack` (PNG hi‑res)
  - `npm run diagram:stack:svg` (SVG)




