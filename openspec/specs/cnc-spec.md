# AUDESYS CNC G-code 编译器规范

**Spec ID**: CNC-GCODE-v1
**Status**: Draft
**Source**: `docs/modules/cnc/gcode-compiler-design.md` (v1.0, 2026-07-19)
**Date**: 2026-07-19

This document defines the normative specification for the AUDESYS G-code
compiler. Each spec item maps a G-code input to a concrete expected output,
serving as the single source of truth for implementation, testing, and
conformance verification.

---

## 1. 词法分析 (Lexer)

### CNC-LEX-01: 单词法元解析 — 单轴 G0
- **前置条件**: 输入文本 `"G0 X10"`
- **操作**: `tokenize("G0 X10")`
- **期望结果**: `[G(0), X(10.0), EOL]`
- **边界条件**: 大小写 `"g0 x10"` 同等解析; 多余空格 `"G0  X10"` 同等解析; 前导/尾随空白跳过
- **测试映射**: `test_lex_single_word_g0`

### CNC-LEX-02: 多坐标字词法解析 — G1 多轴
- **前置条件**: 输入文本 `"G1 X20 Y30 F500"`
- **操作**: `tokenize("G1 X20 Y30 F500")`
- **期望结果**: `[G(1), X(20.0), Y(30.0), F(500.0), EOL]`
- **边界条件**: 坐标字任意顺序 `"G1 F500 Y30 X20"` 全部正确解析; 重复字母 `"G1 X10 X20"` 取最后一个 X
- **测试映射**: `test_lex_multi_word_g1`

### CNC-LEX-03: 括号注释剥离
- **前置条件**: 输入文本 `"(drill hole)\nG0 X10"`
- **操作**: tokenize，第一行仅含括号注释 `"(drill hole)"`
- **期望结果**: 注释行产生 `[EOL]`; 第二行 `[G(0), X(10.0), EOL]`
- **边界条件**: 内嵌注释 `"G0 (rapid) X10"` → 识别 `G(0)`, Token::Comment("rapid"), `X(10.0)`; 跨行注释 `"(multi\nline)"` → 累积为单个 Comment token; 空注释 `"()"` → Comment("")
- **测试映射**: `test_lex_parenthesized_comment`

### CNC-LEX-04: 分号行尾注释剥离
- **前置条件**: 输入文本 `"G0 X10 ; rapid to start"`
- **操作**: `tokenize("G0 X10 ; rapid to start")`
- **期望结果**: `[G(0), X(10.0), EOL]` — 分号及之后内容被忽略
- **边界条件**: 仅注释行 `"; pure comment"` → `[EOL]`; 分号前无空格 `"G0 X10;comment"` → 正确识别 X(10.0)，comment 丢弃
- **测试映射**: `test_lex_semicolon_comment`

### CNC-LEX-05: 行号 N 处理
- **前置条件**: 输入文本 `"N100 G0 X10"`
- **操作**: `tokenize("N100 G0 X10")`
- **期望结果**: `[N(100), G(0), X(10.0), EOL]`
- **边界条件**: Phase 1 不验证行号连续性 (GRBL 也不验证); `N0` 有效; `N99999` 有效 (u32)
- **测试映射**: `test_lex_line_number`

### CNC-LEX-06: 可选行跳过 /
- **前置条件**: 输入文本 `"/ G0 X10"`
- **操作**: tokenize，识别 `/` 为可选块跳过标记
- **期望结果**: `[Token::BlockSkip, G(0), X(10.0), EOL]`
- **边界条件**: Phase 1 保留 token 不执行跳过逻辑; 行首空白后 `/` 仍识别; 行中 `/` 视为语法错误 (`G0 / X10` → UnsupportedCommand)
- **测试映射**: `test_lex_optional_block_skip`

### CNC-LEX-07: 未知字母拒绝
- **前置条件**: 输入文本 `"Q10"`
- **操作**: tokenize，识别字母 `Q` 不在已知字母集中
- **期望结果**: 标记为 `Token::UnknownLetter('Q', 10.0)` 或立即返回 `GCodeError::UnsupportedCommand { line: 1, code: "Q" }`
- **边界条件**: `H`, `D`, `L` 等其他未知字母同等处理; 单字母无数字 `"Q"` → 报错
- **测试映射**: `test_lex_unknown_letter`

### CNC-LEX-08: 大小写不敏感
- **前置条件**: 输入文本 `"g0 x10 f500 m3 s1000"`
- **操作**: `tokenize("g0 x10 f500 m3 s1000")` 全部小写输入
- **期望结果**: `[G(0), X(10.0), F(500.0), M(3), S(1000.0), EOL]`
- **边界条件**: 混合大小写 `"G0 x10 F500 m3 S1000"` → 同等解析; 程序分界符 `%` 大小写不变
- **测试映射**: `test_lex_case_insensitivity`

---

## 2. 模态状态 (Modal State)

### CNC-MOD-01: G90 绝对坐标跨行继承
- **前置条件**: 模态状态 `coord_mode = Absolute`; 输入 `"G0 X30"`
- **操作**: 解析第 2 行，以第 1 行的 `G90` 为模态基准
- **期望结果**: `GCodeCommand { coord_mode: Absolute, target_x: 30.0 }`
- **边界条件**: G90 后不写坐标字的行 (如 `"M3 S1000"`) 不修改 current_pos; G90 显式重复 `"G90 G0 X10\nG90 X20"` → 第二次 G90 no-op
- **测试映射**: `test_modal_g90_absolute_inheritance`

### CNC-MOD-02: G91 增量坐标跨行继承
- **前置条件**: 模态状态 `coord_mode = Incremental`; 输入 `"G0 X10"` 且 current_pos = (5, 0, 0)
- **操作**: 解析行时累加增量到 current_pos
- **期望结果**: `GCodeCommand { target_x: 15.0 }` (5 + 10)
- **边界条件**: G91 下 `"X0"` → 位置不变; G91 下仅 Z 轴 `"G0 Z-2"` → current_pos z 减 2; G91→G90 切换后坐标按绝对值
- **测试映射**: `test_modal_g91_incremental_inheritance`

### CNC-MOD-03: G20/G21 单位跨行继承
- **前置条件**: 模态 `unit_mode = Inch` (G20); 输入 `"G1 X1.0 F50"`
- **操作**: 编译时转换为毫米 — X 目标 = 25.4 mm
- **期望结果**: `GCodeCommand` 中所有坐标值已转为毫米; IR 中 `Load r0, 25.4`
- **边界条件**: G20→G21 切换行 `"G21\nG1 X1.0"` → 第二个 X=1.0 mm 不转换; G20 下 F 值 (inch/min) 也需转换 → F50 inch/min = 1270 mm/min → step 按 mm 计算
- **测试映射**: `test_modal_unit_inheritance_g20_g21`

### CNC-MOD-04: F 进给速度跨 G1 块继承
- **前置条件**: 模态 `feedrate = 500.0`; 输入 `"G1 X30"` (行内无 F)
- **操作**: 合并模态 feedrate → 计算步进量
- **期望结果**: G1 的 IR 包含 `step_x = dx / cycles` 且 cycles 基于 feedrate=500
- **边界条件**: G1 后 G0 不消耗 F (G0 无需 feedrate); G1 后 M3 不消耗 F; 进给速度 0 → 编译时警告 (零速度移动不生成步进循环)
- **测试映射**: `test_modal_feedrate_inheritance`

### CNC-MOD-05: S 主轴转速跨行继承
- **前置条件**: 模态 `spindle_rpm = 1000.0` 且 `spindle_cw = true`; 输入 `"M3"` (无 S)
- **操作**: IR 生成器读取模态 spindle_rpm → `Store "spindle.rpm", r4` (r4=1000.0)
- **期望结果**: spindle.rpm=1000.0, spindle.cw=true
- **边界条件**: M5 后 spindle_rpm 归零; M3 首次无 S → 默认 0 (警告 "M3 without S — spindle speed 0"); M3 S0 → spindle.cw=true 但 rpm=0
- **测试映射**: `test_modal_spindle_speed_inheritance`

### CNC-MOD-06: G17/G18/G19 平面选择继承
- **前置条件**: 模态 `plane = XY` (G17); 输入 `"G2 X50 Y50 I10 J0 F400"`
- **操作**: 解析时使用当前平面确定 I/J/K 的物理轴映射
- **期望结果**: XY 平面 → I 映射为 X 圆心偏移，J 映射为 Y 圆心偏移; 参数成功解析到 GCodeCommand
- **边界条件**: G17 下 `G2 X50 Z50 I10 K0` → 合法 (K 在 G17 下仍被解析); G18 (XZ) 下 `G2 X50 Z50 I10 K0` → I→X K→Z; G19 (YZ) 下 `G2 Y50 Z50 J10 K0` → J→Y K→Z
- **测试映射**: `test_modal_plane_inheritance`

### CNC-MOD-07: 初始化默认模态状态
- **前置条件**: 新 `ModalState::default()` 或新编译会话开始
- **操作**: 无输入行，直接检查默认状态
- **期望结果**: motion_mode=Rapid(G0), coord_mode=Absolute(G90), unit_mode=Millimeter(G21), plane=XY(G17), feedrate=0.0, spindle_rpm=0.0, current_pos=(0, 0, 0)
- **边界条件**: 首次出现坐标字前无运动模式 → ParseError "无运动模式"; 空程序 → Ok(empty HalProgram) 非错误
- **测试映射**: `test_modal_default_state`

### CNC-MOD-08: G80 取消固定循环
- **前置条件**: 当前 `motion_mode = ArcCW(G2)`; 输入 `"G80"`
- **操作**: G80 token 解析 → 设置 motion_mode 回默认 (Rapid/G0)
- **期望结果**: `motion_mode = Rapid`; 不影响其他模态字段 (coord_mode, unit_mode, plane 等保持)
- **边界条件**: Phase 1 中 G80 仅用于取消 G2/G3 回到 G0; 在 G0/G1 状态下 G80 为 no-op; G80 后坐标字 `"G80 X10"` → G0 X10 (motion_mode 已恢复为 Rapid)
- **测试映射**: `test_modal_g80_cancels_motion`

---

## 3. G0 快速定位 (Rapid)

### CNC-G0-01: G0 单轴绝对定位
- **前置条件**: 模态 `coord_mode = Absolute(G90), unit_mode = Millimeter(G21)`; 输入 `"G0 X10"`
- **操作**: compile
- **期望结果**: IR 输出包含 `Load r0, 10.0` → `Store "axis.0.pos", r0` → `Halt`
- **边界条件**: X=0 → 写 0.0 (非 no-op); 负值 `"G0 X-5"` → Load r0, -5.0
- **测试映射**: `test_g0_single_axis_absolute`

### CNC-G0-02: G0 多轴绝对定位
- **前置条件**: 模态 G90, G21; 输入 `"G0 X10 Y20 Z5"`
- **操作**: compile
- **期望结果**: IR 输出 `Load r0, 10.0; Store axis.0.pos, r0; Load r1, 20.0; Store axis.1.pos, r1; Load r2, 5.0; Store axis.2.pos, r2; Halt`
- **边界条件**: 仅 2 轴 `"G0 X10 Y20"` → 仅写 X/Y; 重复轴 `"G0 X10 X20"` → 取最后一个 X=20.0
- **测试映射**: `test_g0_multi_axis_absolute`

### CNC-G0-03: G91 G0 增量定位
- **前置条件**: 模态 `coord_mode = Incremental(G91)`, `current_pos = (10, 0, 0)`; 输入 `"G0 X5"`
- **操作**: compile — 编译时计算目标 = 10 + 5 = 15.0
- **期望结果**: IR 为绝对坐标 `Load r0, 15.0; Store axis.0.pos, r0; Halt`
- **边界条件**: 负增量 `"G91 G0 X-3"` → 目标 = 7.0; G1 下 G91 同样适用 (编译时解析)
- **测试映射**: `test_g0_incremental`

### CNC-G0-04: G0 无参数 (no-op)
- **前置条件**: 模态 `current_pos = (10, 20, 5)`; 输入 `"G0"` (无坐标字)
- **操作**: compile
- **期望结果**: IR 仅 `Halt` 指令 — 无任何 Signal 写入
- **边界条件**: motion_mode 仍保持 Rapid; current_pos 不变
- **测试映射**: `test_g0_noop`

---

## 4. G1 直线插补 (Linear Interpolation)

### CNC-G1-01: G1 单轴步进循环
- **前置条件**: 输入 `"G1 X30 F500"`, current_pos=(10, 0, 0), cycle_ms=10
- **操作**: compile — 计算 dx=20, step_x=20/cycles, cycles=240
- **期望结果**: IR 包含步进循环 (loop_start: Load axis.0.pos; Add step_x; Store axis.0.pos; Sub count; Eq 0; JumpIf loop_start; Halt)
- **边界条件**: 非常小的移动 `"G1 X10.001 F100"` → dx≈0.001, cycles≥1; F 值极低 `"G1 X30 F1"` → cycles 很大但不出错
- **测试映射**: `test_g1_single_axis_linear`

### CNC-G1-02: G1 多轴同步步进
- **前置条件**: 输入 `"G1 X30 Y40 F500"`, current_pos=(10, 20, 0), cycle_ms=10
- **操作**: compile — dx=20, dy=20, dist=28.284, cycles=339, step_x=0.0589, step_y=0.0589
- **期望结果**: IR 循环每周期同时累加 X 和 Y 步进量 (不单独完成任一轴); 所有轴同时到达目标
- **边界条件**: 单轴不移动 `"G1 X30 Y20 F500"` (dy=0) → step_y=0 仍生成指令但不写入 Y (单轴优化); 负移动 `"G1 X10"` (dx=-20) → step_x 为负
- **测试映射**: `test_g1_multi_axis_synchronized`

### CNC-G1-03: G1 无 F 进给速度 — 错误
- **前置条件**: 模态 `feedrate = 0`; 输入 `"G1 X10"` (无 F)
- **操作**: compile — 检测 feedrate 为 0
- **期望结果**: `Err(GCodeError::MissingParameter { line: 1, param: "F" })`
- **边界条件**: 若前一行设置了 F500 但当前行无 F → 继承模态 feedrate=500 不报错
- **测试映射**: `test_g1_missing_feedrate_error`

### CNC-G1-04: G1 零行程移动
- **前置条件**: 输入 `"G1 X10 F500"`, current_pos=(10, 0, 0)
- **操作**: compile — dx=0, dist=0
- **期望结果**: IR 包含 `Load r0, 10.0; Store axis.0.pos, r0; Halt` — 零行程退化为单周期写入 (类似 G0)
- **边界条件**: 多轴零行程 `"G1 X10 Y20 F500"` with current_pos=(10,20,0) → 同样退化; 不生成步进循环
- **测试映射**: `test_g1_zero_move`

### CNC-G1-05: 每周期步进量计算
- **前置条件**: dx=20mm, F=500 mm/min, cycle_ms=10
- **操作**: 编译时计算 `step_per_cycle = dx / ceil(distance / (feedrate / 60_000 * cycle_ms))`
- **期望结果**: dist=20mm, time=20/500*60=2.4s, cycles=240, step_x=20/240=0.08333... mm/cycle
- **边界条件**: 非常慢的进给 `"G1 X1 F1"` → cycles=6000 (1mm / (1/60000*10)mm); 非常快的进给 `"G1 X1000 F10000"` → cycles=60; cycles 最小值为 1 (整个移动在一个周期内完成)
- **测试映射**: `test_g1_step_per_cycle_calculation`

---

## 5. G2/G3 圆弧 (Arc — Phase 1 parse-only)

### CNC-ARC-01: G2 I/J 圆心偏移解析
- **前置条件**: 模态 `plane = XY(G17)`; 输入 `"G2 X50 Y50 I10 J0 F400"`
- **操作**: parse — 成功解析所有圆弧参数
- **期望结果**: `GCodeCommand { motion: ArcCW, target_x: 50.0, target_y: 50.0, arc_i: 10.0, arc_j: 0.0, feedrate: 400.0 }`; IR 生成 NO_MOTION 或 skip
- **边界条件**: I/J 可为负值; I/J 可为 0; I/J 可为浮点 `I0.5 J-2.3`; I/J/K 与当前平面不相关时仍解析 (如 G17 下 K 仍被存储)
- **测试映射**: `test_arc_g2_ij_parse`

### CNC-ARC-02: G3 R 半径模式解析
- **前置条件**: 模态 G17; 输入 `"G3 X50 Y50 R15 F400"`
- **操作**: parse — 成功解析 R 半径参数
- **期望结果**: `GCodeCommand { motion: ArcCCW, target_x: 50.0, target_y: 50.0, arc_r: 15.0, feedrate: 400.0 }`
- **边界条件**: R=0 → 解析成功但值记录为 0 (Phase 2 插补时检测为错误); R 与 I/J 互斥 — 同时出现报 ParseError; 负 R 值 → 解析成功 (负 R 在 G-code 中表示 >180° 弧)
- **测试映射**: `test_arc_g3_radius_parse`

### CNC-ARC-03: G2 缺少 I/J/R — 错误
- **前置条件**: 模态 G17; 输入 `"G2 X50 Y50 F400"` (无 I/J/K/R)
- **操作**: parse — 检测圆弧参数缺失
- **期望结果**: `Err(GCodeError::MissingParameter { line: 1, param: "I or J or R" })`
- **边界条件**: 仅 I 无 J `"G2 X50 Y50 I10"` → 有效 (J 默认 0); 仅 R 无 I/J `"G2 X50 Y50 R15"` → 有效; 仅 J 无 I `"G2 X50 Y50 J10"` → 有效 (I 默认 0)
- **测试映射**: `test_arc_missing_ij_error`

---

## 6. M-code (辅助功能)

### CNC-MCD-01: M3 S1000 主轴顺时针启动
- **前置条件**: 无前序主轴状态; 输入 `"M3 S1000"`
- **操作**: compile
- **期望结果**: IR `Load r4, 1000.0; Store "spindle.rpm", r4; Load r5, 1.0; Store "spindle.cw", r5; Halt`; 模态更新 `spindle_rpm=1000.0, spindle_state=On(CW)`
- **边界条件**: M3 无 S 参数 → 继承模态 spindle_rpm (若为 0 则警告); M3 重复执行 `"M3 S1000\nM3"` → 第二次 M3 用模态 rpm=1000; M3 S0 → rpm=0 写入 Signal 但 cw=true
- **测试映射**: `test_mcode_m3_spindle_cw`

### CNC-MCD-02: M4 S500 主轴逆时针启动
- **前置条件**: 无前序主轴状态; 输入 `"M4 S500"`
- **操作**: compile
- **期望结果**: IR `Load r4, 500.0; Store "spindle.rpm", r4; Load r5, 1.0; Store "spindle.ccw", r5; Halt`; 模态更新 `spindle_rpm=500.0, spindle_state=On(CCW)`
- **边界条件**: M3 后 M4 `"M3 S1000\nM4"` → spindle.cw=false, spindle.ccw=true, rpm=1000 (继承); M4 无 S 同 M3 规则
- **测试映射**: `test_mcode_m4_spindle_ccw`

### CNC-MCD-03: M5 主轴停止
- **前置条件**: 当前 `spindle_rpm = 1000.0, spindle_state = On(CW)`; 输入 `"M5"`
- **操作**: compile
- **期望结果**: IR `Load r5, 0.0; Store "spindle.cw", r5; Store "spindle.rpm", r5; Halt`; 模态更新 `spindle_rpm=0.0, spindle_state=Off`
- **边界条件**: 已有 M4 后 M5 → 同时清零 cw 和 ccw; M5 重复执行 no-op (spindle.cw 已为 0); M5 后 M3 → 正常启动
- **测试映射**: `test_mcode_m5_spindle_off`

### CNC-MCD-04: M30 程序结束
- **前置条件**: 正常执行程序，所有运动指令已完成; 输入 `"M30"`
- **操作**: compile
- **期望结果**: IR `Load r15, 1.0; Store "program.complete", r15; Halt`
- **边界条件**: M30 前程序无有效指令 → 仍输出 program.complete + Halt; M30 出现在程序中间 → 后续指令不会被编译 (编译器在 M30 行停止)
- **测试映射**: `test_mcode_m30_program_end`

### CNC-MCD-05: M99 未知 M-code — 错误
- **前置条件**: 输入 `"M99"`
- **操作**: tokenize/parse — 识别 M99 不在 Phase 1 支持列表中
- **期望结果**: `Err(GCodeError::UnsupportedCommand { line: 1, code: "M99" })`
- **边界条件**: 所有未实现 M-code (M0, M1, M2, M6-M29, M31-M98, M100+) 均返回 UnsupportedCommand; M30 是唯一支持的 M-code 结束指令 (Phase 1 不支持 M2)
- **测试映射**: `test_mcode_unknown_m_error`

---

## 7. 集成 (Integration)

### CNC-INT-01: 完整编译流水线 G0 → HalProgram
- **前置条件**: 输入 `"G90 G21\nG0 X10\nM30"`
- **操作**: `gcode_compile(source)` — 完整 lex → parse → ir generate
- **期望结果**: `Ok(HalProgram)`; `program.name = "unnamed"`; signals 包含 `axis.0.pos` (F64, Write); instructions 包含 G0 Load/Store 序列 + M30 Halt
- **边界条件**: 单行程序 `"M30"` → 仅 program.complete + Halt; 无 M30 结尾 → 仍成功编译 (M30 可选); 仅注释行 `"(no code)"` → Ok(空 HalProgram)
- **测试映射**: `test_compile_full_pipeline_g0`

### CNC-INT-02: Signal 绑定自动生成
- **前置条件**: 输入 `"G0 X10 Y20 Z5"` — 三轴均被引用
- **操作**: `gcode_compile(source)` → 检查 `program.signals`
- **期望结果**: signals 包含 axis.0.pos, axis.0.vel, axis.0.enable, axis.1.pos, axis.1.vel, axis.1.enable, axis.2.pos, axis.2.vel, axis.2.enable (9 个)
- **边界条件**: 仅 X 轴引用 `"G0 X10"` → 仅生成 axis.0.* (3 个 signals); M3 引用 → 生成 spindle.cw, spindle.rpm; 对未引用的轴不生成绑定
- **测试映射**: `test_compile_signal_bindings_auto`

### CNC-INT-03: 多行程序 G90→G91 模态转换
- **前置条件**: 输入:
  ```
  G90 G21
  G0 X0 Y0
  G1 X10 F500
  G91
  G1 X5 F500
  M30
  ```
- **操作**: full compile — 验证中间模态切换
- **期望结果**: 第 3 行 IR G1 目标 = (10, 0, 0) (G90); 第 5 行 IR G1 目标 = (15, 0, 0) (G91, 增量累加到 current_pos)
- **边界条件**: G90↔G91 多次切换; 中间无 S 的 M3 继承前一行的 spindle_rpm
- **测试映射**: `test_compile_multiline_modal_transition`

### CNC-INT-04: 空程序 → 空 HalProgram
- **前置条件**: 输入 `""` (空字符串)
- **操作**: `gcode_compile("")`
- **期望结果**: `Ok(HalProgram { name: "unnamed", signals: [], instructions: [] })` — 不报错
- **边界条件**: 仅空白/注释的输入 `"  \n; comment\n (block)\n"` → 同等结果; 仅 `%` 分界符 → 同等结果
- **测试映射**: `test_compile_empty_program`

---

## 8. 错误处理

### CNC-ERR-01: 坐标字前无运动模式
- **前置条件**: 新编译会话 (motion_mode 未设置); 输入 `"X10"`
- **操作**: parse — 首行出现坐标字但无 G0/G1
- **期望结果**: `Err(GCodeError::ParseError { line: 1, msg: "无运动模式" })`
- **边界条件**: G90 后紧接坐标字 `"G90\nX10"` → 同样报错 (G90 不设置 motion_mode); G0 后 `"G0\nX10"` → 有效 (继承 G0)
- **测试映射**: `test_error_coord_without_motion_mode`

### CNC-ERR-02: 未知 G-code
- **前置条件**: 输入 `"G999"`
- **操作**: tokenize — 识别 G(999) 不在支持列表中
- **期望结果**: `Err(GCodeError::UnsupportedCommand { line: 1, code: "G999" })`
- **边界条件**: G100+, G9999 → 均 UnsupportedCommand; Phase 1 不支持的合法 RS274 G-code (如 G54, G81) 也返回 UnsupportedCommand
- **测试映射**: `test_error_unknown_gcode`

### CNC-ERR-03: 数值解析失败
- **前置条件**: 输入 `"G0 Xabc"` 或 `"G0 X1.2.3"`
- **操作**: tokenize — 字母后数值无法解析为 f64
- **期望结果**: `Err(GCodeError::ParseError { line: 1, msg: "数值解析失败: 'abc'" })`
- **边界条件**: `"X"` 后无数字 → MissingParameter; 科学计数法 `"X1e999"` → 溢出 F64::MAX → ParseError; `"X1e-999"` → 下溢为 0.0 (不报错)
- **测试映射**: `test_error_invalid_number`

### CNC-ERR-04: 寄存器溢出
- **前置条件**: 极复杂单行 (超出 16 寄存器)
- **操作**: compile — 寄存器分配超过 16
- **期望结果**: `Err(GCodeError::RegisterOverflow { required: N })` where N > 16
- **边界条件**: Phase 1 G1 三轴仅需 ~9 寄存器，不易触发溢出; 子程序/宏展开 (Phase 3+) 可能触发; 每个 cycle 周期不累积寄存器使用
- **测试映射**: `test_error_register_overflow`

---

## 参考交叉引用

| 来源 | 文档 |
|------|------|
| G-code 编译器设计 | `docs/modules/cnc/gcode-compiler-design.md` |
| 变更提案 | `.sisyphus/plans/add-gcode-compiler/proposal.md` |
| 详细设计 | `.sisyphus/plans/add-gcode-compiler/design.md` |
| HAL 协议原语 | `docs/modules/hal/hal-protocol-design.md` |
| Signal 命名约定 | `docs/modules/hal/hal-protocol-design.md` (S-SIG-006) |
| 错误模型 D46 | `docs/modules/hal/error-model-design.md` |
| 决策 D55 (CNC 策略) | `.agents/memorys/decisions.md` |
| CNC 参考模型 | `docs/modules/cnc/cnc-reference-models.md` |
