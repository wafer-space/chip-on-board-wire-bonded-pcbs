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
| [`1x1-cob/wirebonding/`](1x1-cob/wirebonding/README.md) | Wirebonding layout and design rules |
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
