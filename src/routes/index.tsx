import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Star Voyager — Space Shooter" },
      { name: "description", content: "Pilot a starfighter through waves of enemies in this fast-paced browser space shooter." },
      { property: "og:title", content: "Star Voyager — Space Shooter" },
      { property: "og:description", content: "Pilot a starfighter through waves of enemies in this fast-paced browser space shooter." },
    ],
  }),
  component: Index,
});

type Vec = { x: number; y: number };
type Bullet = Vec & { vy: number; from: "player" | "enemy" };
type Enemy = Vec & { vx: number; vy: number; hp: number; r: number; cooldown: number };
type Particle = Vec & { vx: number; vy: number; life: number; max: number; color: string };
type Star = { x: number; y: number; z: number };

function Index() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const resetKey = useRef(0);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const H = (canvas.height = canvas.clientHeight * devicePixelRatio);
    const scale = devicePixelRatio;

    const player = { x: W / 2, y: H - 80 * scale, r: 16 * scale, cooldown: 0, invuln: 60 };
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let particles: Particle[] = [];
    const stars: Star[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: Math.random() * 1 + 0.2,
    }));

    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase()))
        e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    const pointer = { x: player.x, y: player.y, active: false, fire: false };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) * scale;
      pointer.y = (e.clientY - rect.top) * scale;
      pointer.active = true;
    };
    const onPDown = (e: PointerEvent) => {
      onMove(e);
      pointer.fire = true;
    };
    const onPUp = () => (pointer.fire = false);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onPDown);
    window.addEventListener("pointerup", onPUp);

    let spawnTimer = 0;
    let frame = 0;
    let curScore = 0;
    let curLives = 3;
    let over = false;

    const spawnEnemy = () => {
      const r = (12 + Math.random() * 14) * scale;
      enemies.push({
        x: Math.random() * (W - 2 * r) + r,
        y: -r,
        vx: (Math.random() - 0.5) * 1.5 * scale,
        vy: (0.8 + Math.random() * 1.2) * scale,
        hp: r > 20 * scale ? 3 : 1,
        r,
        cooldown: 60 + Math.random() * 120,
      });
    };

    const burst = (x: number, y: number, color: string, n = 18) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (Math.random() * 3 + 1) * scale;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 40,
          max: 40,
          color,
        });
      }
    };

    let raf = 0;
    const loop = () => {
      frame++;
      // background
      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, W, H);
      // nebula glow
      const grd = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.7);
      grd.addColorStop(0, "rgba(80,40,140,0.25)");
      grd.addColorStop(1, "rgba(5,6,15,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // stars
      for (const s of stars) {
        s.y += s.z * 2 * scale;
        if (s.y > H) {
          s.y = 0;
          s.x = Math.random() * W;
        }
        ctx.fillStyle = `rgba(255,255,255,${s.z})`;
        ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2);
      }

      // input
      const speed = 5 * scale;
      if (keys.has("arrowleft") || keys.has("a")) player.x -= speed;
      if (keys.has("arrowright") || keys.has("d")) player.x += speed;
      if (keys.has("arrowup") || keys.has("w")) player.y -= speed;
      if (keys.has("arrowdown") || keys.has("s")) player.y += speed;
      if (pointer.active) {
        const dx = pointer.x - player.x;
        const dy = pointer.y - player.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
          const m = Math.min(d, speed * 1.4);
          player.x += (dx / d) * m;
          player.y += (dy / d) * m;
        }
      }
      player.x = Math.max(player.r, Math.min(W - player.r, player.x));
      player.y = Math.max(player.r, Math.min(H - player.r, player.y));
      if (player.invuln > 0) player.invuln--;

      // shoot
      player.cooldown--;
      const firing = keys.has(" ") || keys.has("z") || pointer.fire;
      if (firing && player.cooldown <= 0) {
        bullets.push({ x: player.x - 6 * scale, y: player.y - player.r, vy: -10 * scale, from: "player" });
        bullets.push({ x: player.x + 6 * scale, y: player.y - player.r, vy: -10 * scale, from: "player" });
        player.cooldown = 8;
      }

      // spawn
      spawnTimer--;
      const difficulty = 1 + frame / 3600;
      if (spawnTimer <= 0) {
        spawnEnemy();
        spawnTimer = Math.max(20, 60 - frame / 200);
      }

      // update bullets
      bullets = bullets.filter((b) => {
        b.y += b.vy;
        return b.y > -20 && b.y < H + 20;
      });

      // update enemies
      for (const e of enemies) {
        e.x += e.vx;
        e.y += e.vy * difficulty;
        if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
        e.cooldown--;
        if (e.cooldown <= 0 && e.y > 0 && e.y < H * 0.7) {
          bullets.push({ x: e.x, y: e.y + e.r, vy: 5 * scale, from: "enemy" });
          e.cooldown = 90 + Math.random() * 120;
        }
      }

      // collisions: player bullets vs enemies
      for (const b of bullets) {
        if (b.from !== "player") continue;
        for (const e of enemies) {
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r) {
            e.hp--;
            b.y = -999;
            burst(b.x, b.y, "#ffd66b", 6);
            if (e.hp <= 0) {
              burst(e.x, e.y, "#ff6b9d", 24);
              e.y = H + 999;
              curScore += 10;
              setScore(curScore);
            }
            break;
          }
        }
      }
      enemies = enemies.filter((e) => e.y < H + 60 && e.hp > 0);
      bullets = bullets.filter((b) => b.y < H + 20 && b.y > -20);

      // enemy bullets vs player & enemy bodies vs player
      const hit = (x: number, y: number, r: number) =>
        player.invuln <= 0 && Math.hypot(x - player.x, y - player.y) < r + player.r * 0.7;

      for (const b of bullets) {
        if (b.from === "enemy" && hit(b.x, b.y, 4 * scale)) {
          b.y = H + 999;
          curLives--;
          setLives(curLives);
          player.invuln = 90;
          burst(player.x, player.y, "#7ad7ff", 20);
        }
      }
      for (const e of enemies) {
        if (hit(e.x, e.y, e.r)) {
          curLives--;
          setLives(curLives);
          player.invuln = 90;
          burst(e.x, e.y, "#ff6b9d", 24);
          e.hp = 0;
        }
      }
      enemies = enemies.filter((e) => e.hp > 0);
      bullets = bullets.filter((b) => b.y < H + 20);

      // particles
      particles = particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
      });
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3 * scale, 3 * scale);
      }
      ctx.globalAlpha = 1;

      // draw bullets
      for (const b of bullets) {
        ctx.fillStyle = b.from === "player" ? "#7ad7ff" : "#ff6b9d";
        ctx.fillRect(b.x - 2 * scale, b.y - 8 * scale, 4 * scale, 12 * scale);
      }

      // draw enemies
      for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = e.hp > 1 ? "#c2410c" : "#9333ea";
        ctx.beginPath();
        ctx.moveTo(0, e.r);
        ctx.lineTo(e.r, -e.r * 0.5);
        ctx.lineTo(0, -e.r * 0.2);
        ctx.lineTo(-e.r, -e.r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fde68a";
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // draw player
      if (player.invuln <= 0 || frame % 8 < 4) {
        ctx.save();
        ctx.translate(player.x, player.y);
        // engine flame
        ctx.fillStyle = "#fb923c";
        ctx.beginPath();
        ctx.moveTo(-6 * scale, player.r * 0.8);
        ctx.lineTo(0, player.r * 1.5 + Math.random() * 6 * scale);
        ctx.lineTo(6 * scale, player.r * 0.8);
        ctx.fill();
        // body
        ctx.fillStyle = "#7ad7ff";
        ctx.beginPath();
        ctx.moveTo(0, -player.r);
        ctx.lineTo(player.r, player.r);
        ctx.lineTo(0, player.r * 0.5);
        ctx.lineTo(-player.r, player.r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, player.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (curLives <= 0 && !over) {
        over = true;
        setGameOver(true);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onPDown);
      window.removeEventListener("pointerup", onPUp);
    };
  }, [started, resetKey.current]);

  const restart = () => {
    resetKey.current++;
    setScore(0);
    setLives(3);
    setGameOver(false);
    setStarted(true);
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05060f] text-white">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-4 font-mono text-sm tracking-widest">
        <div className="rounded border border-cyan-400/30 bg-black/40 px-3 py-1.5 backdrop-blur">
          SCORE <span className="ml-2 text-cyan-300">{score.toString().padStart(5, "0")}</span>
        </div>
        <div className="rounded border border-pink-400/30 bg-black/40 px-3 py-1.5 backdrop-blur">
          LIVES <span className="ml-2 text-pink-300">{"♥".repeat(Math.max(0, lives))}</span>
        </div>
      </div>

      {!started && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-md rounded-2xl border border-cyan-400/30 bg-black/60 p-8 text-center backdrop-blur">
            <h1 className="font-mono text-3xl font-bold tracking-widest text-cyan-300">STAR VOYAGER</h1>
            <p className="mt-3 text-sm text-white/70">
              Arrows / WASD to fly, Space to fire. On mobile, drag and tap.
            </p>
            <button
              onClick={restart}
              className="mt-6 rounded-md border border-cyan-400/60 bg-cyan-400/10 px-6 py-2 font-mono text-sm tracking-widest text-cyan-200 transition hover:bg-cyan-400/20"
            >
              LAUNCH
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-md rounded-2xl border border-pink-400/40 bg-black/70 p-8 text-center backdrop-blur">
            <h2 className="font-mono text-3xl font-bold tracking-widest text-pink-300">GAME OVER</h2>
            <p className="mt-3 font-mono text-white/80">Final score: {score}</p>
            <button
              onClick={restart}
              className="mt-6 rounded-md border border-pink-400/60 bg-pink-400/10 px-6 py-2 font-mono text-sm tracking-widest text-pink-200 transition hover:bg-pink-400/20"
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
