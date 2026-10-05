import { Booklet } from '../types/game';

const W = 900;
const PAD = 36;
const IMG_W = 600;
const IMG_H = 450;

const STEP_LABEL = { WORD: '📝 제시어', DRAWING: '🎨 그림', GUESS: '💬 추측' } as const;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 스케치북 한 권을 세로로 긴 한 장의 PNG 로 만든다. */
export async function renderBookletToBlob(booklet: Booklet): Promise<Blob> {
  try {
    await document.fonts.load('32px Jua');
  } catch {
    /* 폰트 로딩 실패 시 기본 폰트로 진행 */
  }
  const images = await Promise.all(booklet.steps.map((s) => (s.type === 'DRAWING' ? loadImage(s.content) : null)));

  const blockH = (i: number) => (booklet.steps[i].type === 'DRAWING' ? IMG_H + 84 : 150);
  const headerH = 130;
  const total = booklet.steps.reduce((sum, _s, i) => sum + blockH(i) + 18, headerH + PAD) + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = total;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff6dc';
  ctx.fillRect(0, 0, W, total);

  ctx.fillStyle = '#1d1b3a';
  ctx.textAlign = 'center';
  ctx.font = '46px Jua, sans-serif';
  ctx.fillText(`${booklet.ownerAvatar} ${booklet.ownerName}의 스케치북`, W / 2, 70);
  ctx.font = '22px Jua, sans-serif';
  ctx.fillStyle = '#6b6890';
  ctx.fillText('텔레스트레이션 · 그림으로 전하는 말', W / 2, 106);

  let y = headerH;
  booklet.steps.forEach((step, i) => {
    const h = blockH(i);
    ctx.fillStyle = '#1d1b3a';
    roundRect(ctx, PAD + 5, y + 6, W - PAD * 2, h, 22);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d1b3a';
    ctx.lineWidth = 4;
    roundRect(ctx, PAD, y, W - PAD * 2, h, 22);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1d1b3a';
    ctx.font = '26px Jua, sans-serif';
    ctx.fillText(`${i + 1}. ${STEP_LABEL[step.type]}`, PAD + 24, y + 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6b6890';
    ctx.fillText(`${step.authorAvatar} ${step.authorName}`, W - PAD - 24, y + 44);

    ctx.textAlign = 'center';
    if (step.type === 'DRAWING') {
      const x = (W - IMG_W) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y + 66, IMG_W, IMG_H);
      const img = images[i];
      if (img) ctx.drawImage(img, x, y + 66, IMG_W, IMG_H);
      else {
        ctx.fillStyle = '#9a98b5';
        ctx.font = '28px Jua, sans-serif';
        ctx.fillText('(그림 없음)', W / 2, y + 66 + IMG_H / 2);
      }
      ctx.strokeStyle = '#1d1b3a';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y + 66, IMG_W, IMG_H);
    } else {
      ctx.fillStyle = step.type === 'WORD' ? '#ff5a5f' : '#3a86ff';
      ctx.font = '54px Jua, sans-serif';
      ctx.fillText(`"${step.content}"`, W / 2, y + 108, W - PAD * 2 - 48);
    }
    y += h + 18;
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 생성 실패'))), 'image/png');
  });
}

export async function downloadBooklet(booklet: Booklet): Promise<void> {
  const blob = await renderBookletToBlob(booklet);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `텔레스트레이션_${booklet.ownerName}의_스케치북.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
