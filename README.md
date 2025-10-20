# chip-on-board-wire-bonded-pcbs
This is still a work in progress!

This repository is the workspace and repo for [wafer.space](https://wafer.space)

Current versions of padframe and wirebonding locations follow [tinytapeout's](https://tinytapeout.com/) convention of 74 pads. 
All GND are tied together in Default Breakout COB package

<img width="641" height="678" alt="image" src="https://github.com/user-attachments/assets/1ac178cc-2c6d-4cfc-9853-fa36316e7458" />

| Bond Pad | Breakout Pad | DEFAULT       | TT Function     |
|-----------|----------|---------------|-----------------|
| 0         | 1        | user_defined  | ctrl_ena        |
| 1         | 2        | user_defined  | ctrl_sel_inc    |
| 2         | 3        | user_defined  | ctrl_sel_rst_n  |
| 3         | 4        | user_defined  | rsvd            |
| 4         | 5        | user_defined  | rsvd            |
| 5         | 6        | user_defined  | rsvd            |
| 6         | 7        | user_defined  | rsvd            |
| 7         | 8        | user_defined  | rsvd            |
| 8         | 9        | <span style="color:gray; font-weight:bold;">GND IO</span> | <span style="color:gray; font-weight:bold;">GND IO</span> |
| 9         | 10       | user_defined  | uo[0]           |
| 10        | 11       | user_defined  | uo[1]           |
| 11        | 12       | user_defined  | uo[2]           |
| 12        | 13       | user_defined  | uo[3]           |
| 13        | 14       | user_defined  | uo[4]           |
| 14        | 15       | user_defined  | uo[5]           |
| 15        | 16       | user_defined  | uo[6]           |
| 16        | 17       | user_defined  | uo[7]           |
| 17        | 18       | <span style="color:red; font-weight:bold;">VDD IO</span> | <span style="color:red; font-weight:bold;">VDD IO</span> |
| 18        | 19       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 19        | 20       | user_defined  | analog[0]       |
| 20        | 21       | user_defined  | analog[1]       |
| 21        | 22       | user_defined  | analog[2]       |
| 22        | 23       | user_defined  | analog[3]       |
| 23        | 24       | user_defined  | analog[4]       |
| 24        | 25       | user_defined  | analog[5]       |
| 25        | 26       | <span style="color:blue; font-weight:bold;">PWR Aux</span> | <span style="color:blue; font-weight:bold;">PWR Aux</span> |
| 26        | 27       | <span style="color:gray; font-weight:bold;">GND IO</span> | <span style="color:gray; font-weight:bold;">GND IO</span> |
| 27        | 28       | user_defined  | analog[6]       |
| 28        | 29       | user_defined  | analog[7]       |
| 29        | 30       | user_defined  | analog[8]       |
| 30        | 31       | user_defined  | analog[9]       |
| 31        | 32       | user_defined  | analog[10]      |
| 32        | 33       | user_defined  | analog[11]      |
| 33        | 34       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 34        | 35       | <span style="color:orange; font-weight:bold;">VDD Core</span> | <span style="color:orange; font-weight:bold;">VDD Core</span> |
| 35        | 36       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 36        | 37       | <span style="color:red; font-weight:bold;">VDD IO</span> | <span style="color:red; font-weight:bold;">VDD IO</span> |
| 37        | 38       | user_defined  | uio[0]          |
| 38        | 39       | user_defined  | uio[1]          |
| 39        | 40       | user_defined  | uio[2]          |
| 40        | 41       | user_defined  | uio[3]          |
| 41        | 42       | user_defined  | uio[4]          |
| 42        | 43       | user_defined  | uio[5]          |
| 43        | 44       | user_defined  | uio[6]          |
| 44        | 45       | user_defined  | uio[7]          |
| 45        | 46       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 46        | 47       | user_defined  | ui[0]           |
| 47        | 48       | user_defined  | ui[1]           |
| 48        | 49       | user_defined  | ui[2]           |
| 49        | 50       | user_defined  | ui[3]           |
| 50        | 51       | user_defined  | ui[4]           |
| 51        | 52       | user_defined  | ui[5]           |
| 52        | 53       | user_defined  | ui[6]           |
| 53        | 54       | user_defined  | ui[7]           |
| 54        | 55       | user_defined  | u_rst_n         |
| 55        | 56       | user_defined  | u_clk           |
| 56        | 57       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 57        | 58       | <span style="color:red; font-weight:bold;">VDD IO</span> | <span style="color:red; font-weight:bold;">VDD IO</span> |
| 58        | 59       | user_defined  | analog[12]      |
| 59        | 60       | user_defined  | analog[13]      |
| 60        | 61       | user_defined  | analog[14]      |
| 61        | 62       | user_defined  | analog[15]      |
| 62        | 63       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 63        | 64       | <span style="color:blue; font-weight:bold;">PWR Aux</span> | <span style="color:blue; font-weight:bold;">PWR Aux</span> |
| 64        | 65       | user_defined  | analog[16]      |
| 65        | 66       | user_defined  | analog[17]      |
| 66        | 67       | user_defined  | analog[18]      |
| 67        | 68       | user_defined  | analog[19]      |
| 68        | 69       | user_defined  | analog[20]      |
| 69        | 70       | user_defined  | analog[21]      |
| 70        | 71       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 71        | 72       | <span style="color:orange; font-weight:bold;">VDD Core</span> | <span style="color:orange; font-weight:bold;">VDD Core</span> |
| 72        | 73       | <span style="color:gray; font-weight:bold;">GND IO</span> |<span style="color:gray; font-weight:bold;">GND IO</span>|
| 73        | 74       | <span style="color:red; font-weight:bold;">VDD IO</span> | <span style="color:red; font-weight:bold;">VDD IO</span> |


## Example COB layout
*note pin numbers and naming convention still evolving.*

<img width="533" height="457" alt="image" src="https://github.com/user-attachments/assets/5f71ebdc-35b8-407f-9d59-434305b8abb7" />
<img width="533" height="463" alt="image" src="https://github.com/user-attachments/assets/034599b5-a3f3-48c2-93ae-68df6727f374" />

We have also allocated space for components if desired, like decoupling capactitors or others. 

## Default Designs
Default breakouts must share
- wirebonding layout
- PCB size (14mm x 16mm)
- connector location (if present) 

Traces, signal type, and nets are all user definable.

