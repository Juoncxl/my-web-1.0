import { formatDaysLeft, groupScheduleByMonth, type CollabScheduleEntry } from './collabSchedule';

/** Portrait (story-sized) PNG of the upcoming public schedule. Owner ticks are never drawn. */
export const SCHEDULE_IMAGE_WIDTH = 1080;
export const SCHEDULE_IMAGE_HEIGHT = 1920;

const FONT = '"Noto Sans Thai", "Plus Jakarta Sans", sans-serif';
const PAD = 84;
const ROW_HEIGHT = 132;
const MONTH_HEIGHT = 92;

export interface ScheduleImageRow { kind: 'month'; label: string }
export interface ScheduleImageItem { kind: 'item'; day: string; weekday: string; name: string; detail: string; countdown: string; urgent: boolean }

/** Lays out month headings and rows that fit the canvas; the rest is counted as overflow. */
export function layoutScheduleImage(entries: readonly CollabScheduleEntry[], available = SCHEDULE_IMAGE_HEIGHT - 520) {
  const rows: Array<ScheduleImageRow | ScheduleImageItem> = [];
  let used = 0;
  let total = 0;
  let shown = 0;
  for (const month of groupScheduleByMonth(entries)) {
    total += month.items.length;
    if (used + MONTH_HEIGHT + ROW_HEIGHT > available) continue;
    rows.push({ kind: 'month', label: month.label });
    used += MONTH_HEIGHT;
    for (const { entry, milestone } of month.items) {
      if (used + ROW_HEIGHT > available) break;
      rows.push({
        kind: 'item',
        day: String(milestone.date.getDate()),
        weekday: milestone.date.toLocaleDateString('th-TH', { weekday: 'short' }),
        name: entry.name,
        detail: `${milestone.label}${entry.platforms.length ? ` · ${entry.platforms.join(', ')}` : ''}`,
        countdown: formatDaysLeft(milestone.daysLeft),
        urgent: milestone.daysLeft <= 3
      });
      used += ROW_HEIGHT;
      shown += 1;
    }
  }
  return { rows, overflow: total - shown };
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value.trimEnd()}…`;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

export async function renderScheduleImage(entries: readonly CollabScheduleEntry[], subtitle: string): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.load) {
    await Promise.all([document.fonts.load(`800 64px ${FONT}`, 'กำหนดการ'), document.fonts.load(`500 32px ${FONT}`, 'กำหนดการ')]).catch(() => undefined);
  }
  const canvas = document.createElement('canvas');
  canvas.width = SCHEDULE_IMAGE_WIDTH;
  canvas.height = SCHEDULE_IMAGE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');

  const background = context.createLinearGradient(0, 0, SCHEDULE_IMAGE_WIDTH, SCHEDULE_IMAGE_HEIGHT);
  background.addColorStop(0, '#fbf8ff');
  background.addColorStop(0.55, '#eef2fb');
  background.addColorStop(1, '#e4ddff');
  context.fillStyle = background;
  context.fillRect(0, 0, SCHEDULE_IMAGE_WIDTH, SCHEDULE_IMAGE_HEIGHT);

  const contentWidth = SCHEDULE_IMAGE_WIDTH - PAD * 2;
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#7c6bc4';
  context.font = `700 30px ${FONT}`;
  context.fillText('COLLAB SCHEDULE', PAD, 170);
  context.fillStyle = '#01162b';
  context.font = `800 76px ${FONT}`;
  context.fillText('กำหนดการคอลแลป', PAD, 262);
  context.fillStyle = '#5b6b84';
  context.font = `500 34px ${FONT}`;
  context.fillText(fitText(context, subtitle, contentWidth), PAD, 320);

  const { rows, overflow } = layoutScheduleImage(entries);
  let y = 400;
  for (const row of rows) {
    if (row.kind === 'month') {
      context.fillStyle = '#6a90b4';
      context.font = `700 32px ${FONT}`;
      context.fillText(row.label, PAD, y + 56);
      y += MONTH_HEIGHT;
      continue;
    }
    roundRect(context, PAD, y, contentWidth, ROW_HEIGHT - 18, 28);
    context.fillStyle = 'rgba(255, 255, 255, .86)';
    context.fill();
    roundRect(context, PAD + 18, y + 16, 82, 82, 22);
    context.fillStyle = row.urgent ? '#fde4e4' : '#ece7ff';
    context.fill();
    context.textAlign = 'center';
    context.fillStyle = row.urgent ? '#b4233a' : '#4b3d99';
    context.font = `800 40px ${FONT}`;
    context.fillText(row.day, PAD + 59, y + 62);
    context.font = `600 22px ${FONT}`;
    context.fillText(row.weekday, PAD + 59, y + 90);
    context.textAlign = 'left';

    const textX = PAD + 124;
    context.font = `700 26px ${FONT}`;
    const countdownWidth = context.measureText(row.countdown).width;
    context.fillStyle = row.urgent ? '#b4233a' : '#6a90b4';
    context.fillText(row.countdown, PAD + contentWidth - 28 - countdownWidth, y + 54);
    const textWidth = contentWidth - 124 - 28 - countdownWidth - 24;
    context.fillStyle = '#01162b';
    context.font = `700 34px ${FONT}`;
    context.fillText(fitText(context, row.name, textWidth), textX, y + 54);
    context.fillStyle = '#5b6b84';
    context.font = `500 26px ${FONT}`;
    context.fillText(fitText(context, row.detail, contentWidth - 124 - 28), textX, y + 94);
    y += ROW_HEIGHT;
  }
  if (!rows.length) {
    context.fillStyle = '#5b6b84';
    context.font = `500 34px ${FONT}`;
    context.fillText('ยังไม่มีกำหนดการที่กำลังจะถึง', PAD, y + 40);
  }
  if (overflow > 0) {
    context.fillStyle = '#5b6b84';
    context.font = `600 28px ${FONT}`;
    context.fillText(`และอีก ${overflow} กำหนดการ`, PAD, y + 40);
  }

  context.fillStyle = '#7c6bc4';
  context.font = `700 28px ${FONT}`;
  const brand = 'CXL Studio';
  context.fillText(brand, SCHEDULE_IMAGE_WIDTH - PAD - context.measureText(brand).width, SCHEDULE_IMAGE_HEIGHT - 80);

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image')), 'image/png'));
}
