#!/bin/bash
# AUDESYS Studio 构建后门禁检查 (post-build gates)
# 用法: 在 apps/studio/ 下运行 `bash check-gates.sh`
# 门禁:
#   1. workspace 链接: 扩展必须通过 yarn workspaces symlink 解析 (非物理副本)
#   2. 扩展 lib 存在性: 每个扩展 lib/ 必须包含编译产物 (防"改了不生效")
#   3. Symbol 唯一性: bundle.js 中关键 @theia/core Symbol 必须 = 1 (DI 健康)
set -e
FAIL=0

echo "── Gate 1: workspace 链接检查 ──"
for ext in $(ls ../../theia-extensions); do
  if [ ! -d "../../theia-extensions/$ext" ]; then continue; fi
  RESOLVED=$(node -e "
    try {
      const p = require.resolve('$ext/package.json', { paths: [process.cwd()] });
      console.log(p);
    } catch (e) { console.error('UNRESOLVED: $ext'); process.exit(1); }
  ")
  if echo "$RESOLVED" | grep -q "node_modules/$ext/package.json"; then
    echo "FAIL: $ext 解析到物理副本: $RESOLVED"
    echo "  原因: 使用 file: 依赖或本地 node_modules 副本 — 源码修改不生效"
    FAIL=1
  else
    echo "OK: $ext -> $RESOLVED"
  fi
done

echo "── Gate 2: 扩展 lib 存在性检查 ──"
for ext in $(ls ../../theia-extensions); do
  LIB="../../theia-extensions/$ext/lib"
  if [ ! -d "$LIB" ] || [ -z "$(ls $LIB 2>/dev/null)" ]; then
    echo "FAIL: $ext 无 lib/ 编译产物 — 修改 .ts 源码后未执行 npx tsc -b"
    FAIL=1
  fi
done
echo "OK: 全部扩展 lib/ 存在"

echo "── Gate 3: Symbol 唯一性检查 ──"
BUNDLE="lib/frontend/bundle.js"
for s in OpenHandler FrontendApplicationContribution OpenerService WidgetFactory; do
  count=$(grep -c "Symbol(\"$s\")" "$BUNDLE")
  if [ "$count" != "1" ]; then
    echo "FAIL: Symbol($s) = $count (必须 = 1) — DI 绑定将静默失败"
    FAIL=1
  else
    echo "OK: Symbol($s) = 1"
  fi
done

if [ "$FAIL" = "1" ]; then
  echo ""
  echo "❌ 门禁检查失败 — 修复后再提交"
  exit 1
fi
echo ""
echo "✅ 全部门禁通过"
