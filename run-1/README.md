# Run 1

This directory holds the design files for **Run 1** of the [wafer.space](https://wafer.space)
chip-on-board (COB) breakouts.

> **Note:** The pinouts, connector choices, and footprint dimensions documented here are
> **specific to this run** and are expected to change in future runs. Treat this page as the
> source of truth for Run 1 only.

## Contents

| Directory | Description |
| --------- | ----------- |
| [`1x1-cob/`](1x1-cob/) | 14 mm × 16 mm 74-pad / 70-pin mezzanine COB breakout |
| [`1x0p5-cob/`](1x0p5-cob/) · [`0p5x1-cob/`](0p5x1-cob/) | Half-slot COB variants |
| [`wirebonding/`](wirebonding/README.md) | Wirebonding layout and design rules |
| [`motherboards/`](motherboards/README.md) | Example breakout motherboards |

---

## Padframe Reference

Our current padframe and wirebonding layouts follow the [**Tiny Tapeout**](https://tinytapeout.com/)
convention of 74 pads. All ground (GND) connections are tied together in the
**Default Breakout COB package**.

| Bond Pad | Breakout Pad | Default                                                    | TT Function                                                |
| -------- | ------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 0        | 1            | user_defined                                               | ctrl_ena                                                   |
| 1        | 2            | user_defined                                               | ctrl_sel_inc                                               |
| 2        | 3            | user_defined                                               | ctrl_sel_rst_n                                             |
| 3–7      | 4–8          | user_defined                                               | rsvd                                                       |
| 8        | 9            | <span style="color:gray; font-weight:bold;">GND IO</span>  | <span style="color:gray; font-weight:bold;">GND IO</span>  |
| 9–16     | 10–17        | user_defined                                               | uo[0–7]                                                    |
| 17       | 18           | <span style="color:red; font-weight:bold;">VDD IO</span>   | <span style="color:red; font-weight:bold;">VDD IO</span>   |
| 18       | 19           | <span style="color:gray; font-weight:bold;">GND IO</span>  | <span style="color:gray; font-weight:bold;">GND IO</span>  |
| 19–24    | 20–25        | user_defined                                               | analog[0–5]                                                |
| 25       | 26           | <span style="color:blue; font-weight:bold;">PWR Aux</span> | <span style="color:blue; font-weight:bold;">PWR Aux</span> |
| 26–72    | 27–73        | *(see full table for details)*                             | —                                                          |
| 73       | 74           | <span style="color:red; font-weight:bold;">VDD IO</span>   | <span style="color:red; font-weight:bold;">VDD IO</span>   |

> For the complete mapping and color-coded reference, please refer to this [spreadsheet](https://docs.google.com/spreadsheets/d/1pI2BAEWEexXcXN3vah3SR85zPIV6eAXPGXc2bcvoSGU)

---

## Example COB Layout

> *Note: Pin numbering and naming conventions are still evolving.*

<img width="533" height="457" alt="image" src="https://github.com/user-attachments/assets/5f71ebdc-35b8-407f-9d59-434305b8abb7" />
<img width="533" height="463" alt="image" src="https://github.com/user-attachments/assets/034599b5-a3f3-48c2-93ae-68df6727f374" />

Space has been allocated for optional components such as decoupling capacitors and other passive elements.

**Proposed Mezzanine Connectors:**

* 70-pin, 0.4 mm pitch: [LCSC C19089236](https://www.lcsc.com/product-detail/C19089236.html)
* Mating connector: [LCSC C19089262](https://www.lcsc.com/product-detail/C19089262.html)


---

## Default KiCad Symbols

We have developed several **KiCad symbols** to support design and integration with our COB layouts.

The **pad mapping symbol** corresponds to the default 74-pad wirebonding padframe and [default configuration](https://github.com/wafer-space/gf180mcu-project-template/blob/main/librelane/config.yaml) from the [**GF180MCU Project Template**](https://github.com/wafer-space/gf180mcu-project-template).

> Some users have suggested reducing the number of ground and power pads. If there is sufficient demand, an alternate default configuration will be created.
> Join the discussion on our [**Discord server**](https://discord.gg/43y2t53jpE).

![](../images/default_74pad_wirebond_symbol.png)
*Default 74-pad wirebonding padframe*
---

## Default Design Requirements

To maintain compatibility across projects, **default breakouts** must share:

* The same **wirebonding layout**
* The same **PCB footprint** (14 mm × 16 mm)
* The same **connector position** (if applicable)

Traces, signal types, and net assignments are **user-definable**.

---

<!-- AUTO-GEN:START -->
<!-- Generated by .github/scripts/gen_docs.py on release. Edits between the AUTO-GEN markers will be overwritten. -->

## Board Renders

*Generated for release **unreleased** on 2026-10-08.*

### 0p5x1-cob / mezzanine-0p5x1

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/0p5x1-cob/mezzanine-0p5x1/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/0p5x1-cob/mezzanine-0p5x1/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/0p5x1-cob/mezzanine-0p5x1/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/0p5x1-cob/mezzanine-0p5x1/back.svg" width="400" alt="back layers"> |

[PCB](0p5x1-cob/mezzanine-0p5x1.kicad_pcb) · [Schematic source](0p5x1-cob/mezzanine-0p5x1.kicad_sch) · [Schematic PDF](../docs/renders/run-1/0p5x1-cob/mezzanine-0p5x1/schematic.pdf)

### 0p5x1-cob / panelization / panel

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/0p5x1-cob/panelization/panel/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/0p5x1-cob/panelization/panel/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/0p5x1-cob/panelization/panel/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/0p5x1-cob/panelization/panel/back.svg" width="400" alt="back layers"> |

[PCB](0p5x1-cob/panelization/panel.kicad_pcb)

### 1x0p5-cob / mezzanine-1x0p5

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x0p5-cob/mezzanine-1x0p5/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/1x0p5-cob/mezzanine-1x0p5/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x0p5-cob/mezzanine-1x0p5/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/1x0p5-cob/mezzanine-1x0p5/back.svg" width="400" alt="back layers"> |

[PCB](1x0p5-cob/mezzanine-1x0p5.kicad_pcb) · [Schematic source](1x0p5-cob/mezzanine-1x0p5.kicad_sch) · [Schematic PDF](../docs/renders/run-1/1x0p5-cob/mezzanine-1x0p5/schematic.pdf)

### 1x0p5-cob / panelization / panel

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x0p5-cob/panelization/panel/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/1x0p5-cob/panelization/panel/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x0p5-cob/panelization/panel/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/1x0p5-cob/panelization/panel/back.svg" width="400" alt="back layers"> |

[PCB](1x0p5-cob/panelization/panel.kicad_pcb)

### 1x1-cob / 1x1-mezzanine

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x1-cob/1x1-mezzanine/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/1x1-cob/1x1-mezzanine/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x1-cob/1x1-mezzanine/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/1x1-cob/1x1-mezzanine/back.svg" width="400" alt="back layers"> |

[PCB](1x1-cob/1x1-mezzanine.kicad_pcb) · [Schematic source](1x1-cob/1x1-mezzanine.kicad_sch) · [Schematic PDF](../docs/renders/run-1/1x1-cob/1x1-mezzanine/schematic.pdf)

### 1x1-cob / panelization / panel

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x1-cob/panelization/panel/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/1x1-cob/panelization/panel/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/1x1-cob/panelization/panel/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/1x1-cob/panelization/panel/back.svg" width="400" alt="back layers"> |

[PCB](1x1-cob/panelization/panel.kicad_pcb)

### mosbius-panel / panel

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/mosbius-panel/panel/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/mosbius-panel/panel/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/mosbius-panel/panel/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/mosbius-panel/panel/back.svg" width="400" alt="back layers"> |

[PCB](mosbius-panel/panel.kicad_pcb)

### mosbius-panel / V3_COB_Original

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/mosbius-panel/V3_COB_Original/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/mosbius-panel/V3_COB_Original/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/mosbius-panel/V3_COB_Original/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/mosbius-panel/V3_COB_Original/back.svg" width="400" alt="back layers"> |

[PCB](mosbius-panel/V3_COB_Original.kicad_pcb)

### motherboards / motherboards

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/motherboards/motherboards/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/motherboards/motherboards/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/motherboards/motherboards/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/motherboards/motherboards/back.svg" width="400" alt="back layers"> |

[PCB](motherboards/motherboards.kicad_pcb) · [Schematic source](motherboards/motherboards.kicad_sch) · [Schematic PDF](../docs/renders/run-1/motherboards/motherboards/schematic.pdf)

### tqva-cob / panellization / panel

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/tqva-cob/panellization/panel/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/tqva-cob/panellization/panel/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/tqva-cob/panellization/panel/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/tqva-cob/panellization/panel/back.svg" width="400" alt="back layers"> |

[PCB](tqva-cob/panellization/panel.kicad_pcb)

### tqva-cob / tqva-cob

| 3D top | 3D bottom |
| :---: | :---: |
| <img src="../docs/renders/run-1/tqva-cob/tqva-cob/top.png" width="400" alt="top render"> | <img src="../docs/renders/run-1/tqva-cob/tqva-cob/bottom.png" width="400" alt="bottom render"> |

| Front layers | Back layers (mirrored) |
| :---: | :---: |
| <img src="../docs/renders/run-1/tqva-cob/tqva-cob/front.svg" width="400" alt="front layers"> | <img src="../docs/renders/run-1/tqva-cob/tqva-cob/back.svg" width="400" alt="back layers"> |

[PCB](tqva-cob/tqva-cob.kicad_pcb) · [Schematic source](tqva-cob/tqva-cob.kicad_sch) · [Schematic PDF](../docs/renders/run-1/tqva-cob/tqva-cob/schematic.pdf)
<!-- AUTO-GEN:END -->
