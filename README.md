Here’s a more **professional and polished** version of your Markdown — ready to paste directly into your README.md:

---

# Chip-on-Board Wire-Bonded PCBs

> **Status:** Work in Progress

This repository serves as the primary workspace and documentation hub for [**wafer.space**](https://wafer.space).

Our current padframe and wirebonding layouts follow the [**Tiny Tapeout**](https://tinytapeout.com/) convention of 74 pads.
All ground (GND) connections are tied together in the **Default Breakout COB package**.

<img width="641" height="678" alt="image" src="https://github.com/user-attachments/assets/1ac178cc-2c6d-4cfc-9853-fa36316e7458" />

---

## Padframe Reference

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

> For the complete mapping and color-coded reference, please refer to the full pad table above.

---

## Example COB Layout

> *Note: Pin numbering and naming conventions are still evolving.*

<img width="533" height="457" alt="image" src="https://github.com/user-attachments/assets/5f71ebdc-35b8-407f-9d59-434305b8abb7" />
<img width="533" height="463" alt="image" src="https://github.com/user-attachments/assets/034599b5-a3f3-48c2-93ae-68df6727f374" />

Space has been allocated for optional components such as decoupling capacitors and other passive elements.

**Proposed Mezzanine Connectors:**

* 70-pin, 0.4 mm pitch: [LCSC C19089236](https://www.lcsc.com/product-detail/C19089236.html)
* Mating connector: [LCSC C19089262](https://www.lcsc.com/product-image/C19089262.html)

---

## Default KiCad Symbols

We have developed several **KiCad symbols** to support design and integration with our COB layouts.

The **pad mapping symbol** corresponds to the default 74-pad wirebonding padframe and [default configuration](https://github.com/wafer-space/gf180mcu-project-template/blob/main/librelane/config.yaml) from the [**GF180MCU Project Template**](https://github.com/wafer-space/gf180mcu-project-template).

> Some users have suggested reducing the number of ground and power pads. If there is sufficient demand, an alternate default configuration will be created.
> Join the discussion on our [**Discord server**](https://discord.gg/43y2t53jpE).

![](./images/default_74pad_wirebond_symbol.png)
*Default 74-pad wirebonding padframe*

---

### 70-Pin Mezzanine Connector Symbol

The **mezzanine connector symbol** provides a 1:1 pin mapping to the 70-pin default layout.
All pins are aliased to match [Tiny Tapeout](https://tinytapeout.com/) naming conventions.

![](./images/default_70pin_mezzanine_symbol.png)
*Default 70-pin mezzanine COB breakout symbol*

We also provide an alternate version that organizes pins by signal type. Ideal for Tiny Tapeout breakout motherboard designs.

![](./images/tinytapeout_kicad_symbols.png)
*Default 70-pin mezzanine COB breakout symbol TT version*

---

## Default Design Requirements

To maintain compatibility across projects, **default breakouts** must share:

* The same **wirebonding layout**
* The same **PCB footprint** (14 mm × 16 mm)
* The same **connector position** (if applicable)

Traces, signal types, and net assignments are **user-definable**.

---

## Example Motherboards

We’ve designed several example breakout and motherboard PCBs to simplify development and integration with your custom chips.

<img width="1560" height="886" alt="image" src="https://github.com/user-attachments/assets/a5fda81e-ea04-4347-8ed8-b9aa366fdbfd" />

