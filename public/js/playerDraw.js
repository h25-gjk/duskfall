// ═══════════════════════════════════════════════════════════
//  人形角色绘制 - 头/身体/四肢 + 行走动画
// ═══════════════════════════════════════════════════════════

// 绘制人形角色 (俯视角, 略带3/4视角)
// ctx 已平移到角色位置, facing 为弧度
export function drawHumanoid(ctx, x, y, facing, animT, colors, isMoving = false) {
  ctx.save();
  ctx.translate(x, y);

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 根据朝向旋转 (只在水平方向, 保持垂直感)
  // facing: 0=右, PI/2=下, PI=左, -PI/2=上
  const flip = facing > Math.PI / 2 || facing < -Math.PI / 2;
  ctx.scale(flip ? -1 : 1, 1);

  // 行走动画 - 四肢摆动
  const swing = isMoving ? Math.sin(animT) * 3 : 0;
  const bob = isMoving ? Math.abs(Math.sin(animT)) * 1.5 : 0;

  ctx.translate(0, -bob);

  // ── 腿 (从下往上画, 后腿先) ──
  // 后腿
  ctx.fillStyle = colors.pants;
  ctx.fillRect(-3, 4 + swing, 4, 8);
  // 前腿
  ctx.fillRect(-1, 4 - swing, 4, 8);

  // ── 身体 ──
  ctx.fillStyle = colors.shirt;
  ctx.beginPath();
  ctx.ellipse(0, -2, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // 身体高光
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  ctx.beginPath();
  ctx.ellipse(-2, -4, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 手臂 ──
  ctx.fillStyle = colors.shirt;
  // 后手
  ctx.fillRect(-7, -1 + swing, 3, 6);
  // 前手
  ctx.fillRect(4, -1 - swing, 3, 6);
  // 手 (肤色)
  ctx.fillStyle = colors.skin;
  ctx.fillRect(-7, 4 + swing, 3, 3);
  ctx.fillRect(4, 4 - swing, 3, 3);

  // ── 头 ──
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(0, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  // 头部阴影
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  ctx.beginPath();
  ctx.ellipse(0, -6, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 头发 ──
  ctx.fillStyle = colors.hair;
  ctx.beginPath();
  ctx.arc(0, -10, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5, -10, 10, 3);
  // 刘海
  ctx.beginPath();
  ctx.arc(-2, -8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2, -8, 2, 0, Math.PI * 2);
  ctx.fill();

  // ── 脸部细节 (朝向方向) ──
  ctx.fillStyle = '#1a1a2a';
  // 眼睛
  ctx.fillRect(1, -8, 1.5, 1.5);
  ctx.fillRect(3, -8, 1.5, 1.5);

  // ── 装饰色 (围巾/披风等) ──
  ctx.fillStyle = colors.accent;
  ctx.fillRect(-4, -3, 8, 1.5);

  ctx.restore();
}

// 在角色选择界面绘制大号角色预览 (正面, 带光效)
export function drawCharacterPreview(ctx, x, y, colors, t = 0) {
  ctx.save();
  ctx.translate(x, y);

  // 光圈
  const glow = 0.5 + Math.sin(t * 2) * 0.15;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
  grad.addColorStop(0, `rgba(232,213,176,${glow * 0.3})`);
  grad.addColorStop(1, 'rgba(232,213,176,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();

  // 放大2倍绘制
  ctx.scale(2, 2);
  // 正面朝下
  drawHumanoid(ctx, 0, 0, Math.PI / 2, t, colors, false);

  ctx.restore();
}
