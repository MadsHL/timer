import type { TimerPhase } from "./settings";

export type TimerRenderModel = {
	hintText: string;
	nowMs: number;
	phase: TimerPhase;
	remainingMs: number;
	statusText: string;
	timeText: string;
	totalDurationMs: number;
};

type PhasePalette = {
	accentEnd: string;
	accentStart: string;
	backgroundEnd: string;
	backgroundStart: string;
	chipFill: string;
	chipStroke: string;
	glow: string;
	hint: string;
	status: string;
	text: string;
	track: string;
};

const BASE_TRACK = "#1F2937";

const PHASE_PALETTES: Record<TimerPhase, PhasePalette> = {
	idle: {
		accentEnd: "#38BDF8",
		accentStart: "#60A5FA",
		backgroundEnd: "#0F172A",
		backgroundStart: "#111C31",
		chipFill: "rgba(96, 165, 250, 0.10)",
		chipStroke: "rgba(96, 165, 250, 0.22)",
		glow: "rgba(96, 165, 250, 0.12)",
		hint: "#7DD3FC",
		status: "#BBD9FF",
		text: "#F8FAFC",
		track: BASE_TRACK,
	},
	running: {
		accentEnd: "#22C55E",
		accentStart: "#38BDF8",
		backgroundEnd: "#0B1622",
		backgroundStart: "#0D2126",
		chipFill: "rgba(56, 189, 248, 0.12)",
		chipStroke: "rgba(34, 197, 94, 0.24)",
		glow: "rgba(56, 189, 248, 0.22)",
		hint: "#86EFAC",
		status: "#D1FAE5",
		text: "#F8FAFC",
		track: BASE_TRACK,
	},
	paused: {
		accentEnd: "#FBBF24",
		accentStart: "#F59E0B",
		backgroundEnd: "#1A1622",
		backgroundStart: "#231B12",
		chipFill: "rgba(245, 158, 11, 0.12)",
		chipStroke: "rgba(251, 191, 36, 0.22)",
		glow: "rgba(251, 191, 36, 0.22)",
		hint: "#FCD34D",
		status: "#FEF3C7",
		text: "#FFF7ED",
		track: "#2A2230",
	},
	finished: {
		accentEnd: "#FB7185",
		accentStart: "#F97316",
		backgroundEnd: "#1F1020",
		backgroundStart: "#2B1117",
		chipFill: "rgba(249, 115, 22, 0.13)",
		chipStroke: "rgba(251, 113, 133, 0.30)",
		glow: "rgba(251, 113, 133, 0.32)",
		hint: "#FDBA74",
		status: "#FFE4E6",
		text: "#FFF7F7",
		track: "#301C27",
	},
};

export function renderTimerSvg(model: TimerRenderModel): string {
	const palette = PHASE_PALETTES[model.phase];
	const pulse = getPulse(model.phase, model.nowMs);
	const ringRadius = 31;
	const circumference = 2 * Math.PI * ringRadius;
	const progress = model.totalDurationMs > 0 ? clamp(model.remainingMs / model.totalDurationMs, 0, 1) : 0;
	const dashLength = Math.max(progress * circumference, model.phase === "finished" ? circumference : 0);
	const strokeWidth = model.phase === "finished" ? 8.5 + pulse * 2.2 : model.phase === "paused" ? 7.4 + pulse * 1.1 : 7;
	const glowOpacity = model.phase === "finished" ? 0.30 + pulse * 0.30 : model.phase === "paused" ? 0.18 + pulse * 0.15 : model.phase === "running" ? 0.26 : 0.10;
	const backgroundInset = model.phase === "finished" ? 3 + pulse * 1.5 : model.phase === "paused" ? 2 + pulse : 2;
	const timeFontSize = model.timeText.length > 7 ? 22 : model.timeText.length > 5 ? 24 : 28;
	const timeTextLength = model.timeText.length > 7 ? "90" : undefined;
	const hintFontSize = model.hintText.length > 18 ? 9.5 : 10.5;
	const hintTextLength = model.hintText.length > 16 ? "92" : undefined;
	const hintText = escapeXml(model.hintText);
	const statusText = escapeXml(model.statusText.toUpperCase());
	const timeText = escapeXml(model.timeText);
	const marker = renderCenterMarker(model.phase, pulse, palette);
	const timeFitAttributes = timeTextLength ? ` textLength="${timeTextLength}" lengthAdjust="spacingAndGlyphs"` : "";
	const hintFitAttributes = hintTextLength ? ` textLength="${hintTextLength}" lengthAdjust="spacingAndGlyphs"` : "";

	const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" role="img" aria-label="${timeText}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.backgroundStart}" />
      <stop offset="100%" stop-color="${palette.backgroundEnd}" />
    </linearGradient>
    <linearGradient id="ring" x1="10%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="${palette.accentStart}" />
      <stop offset="100%" stop-color="${palette.accentEnd}" />
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.16)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
  </defs>
  <rect x="${backgroundInset}" y="${backgroundInset}" width="${200 - backgroundInset * 2}" height="${100 - backgroundInset * 2}" rx="20" fill="url(#bg)" />
  <rect x="${backgroundInset}" y="${backgroundInset}" width="${200 - backgroundInset * 2}" height="${100 - backgroundInset * 2}" rx="20" fill="url(#shine)" opacity="0.10" />
  <circle cx="50" cy="50" r="38" fill="${palette.glow}" opacity="${glowOpacity.toFixed(2)}" />
  <circle cx="50" cy="50" r="34" fill="rgba(2, 6, 23, 0.48)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
  <circle cx="50" cy="50" r="${ringRadius}" fill="none" stroke="${palette.track}" stroke-width="7" stroke-linecap="round" />
  <circle
    cx="50"
    cy="50"
    r="${ringRadius}"
    fill="none"
    stroke="url(#ring)"
    stroke-width="${strokeWidth.toFixed(2)}"
    stroke-linecap="round"
    stroke-dasharray="${dashLength.toFixed(2)} ${circumference.toFixed(2)}"
    transform="rotate(-90 50 50)"
  />
  ${renderIndicator(progress, ringRadius, palette, model.phase)}
  ${marker}
  <rect x="96" y="18" width="84" height="18" rx="9" fill="${palette.chipFill}" stroke="${palette.chipStroke}" />
  <text x="138" y="31" fill="${palette.status}" font-family="'SF Pro Text','Helvetica Neue',sans-serif" font-size="10" font-weight="700" letter-spacing="1.8" text-anchor="middle">${statusText}</text>
  <text x="96" y="62" fill="${palette.text}" font-family="'SF Pro Display','Helvetica Neue',sans-serif" font-size="${timeFontSize}" font-weight="600"${timeFitAttributes}>${timeText}</text>
	  <text x="96" y="81" fill="${palette.hint}" font-family="'SF Pro Text','Helvetica Neue',sans-serif" font-size="${hintFontSize}" font-weight="500"${hintFitAttributes}>${hintText}</text>
	</svg>`.trim();

	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderIndicator(progress: number, radius: number, palette: PhasePalette, phase: TimerPhase): string {
	if (progress <= 0 || phase === "finished") {
		return "";
	}

	const angle = progress * Math.PI * 2 - Math.PI / 2;
	const x = 50 + Math.cos(angle) * radius;
	const y = 50 + Math.sin(angle) * radius;

	return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.1" fill="${palette.accentStart}" stroke="rgba(255,255,255,0.35)" stroke-width="1" />`;
}

function renderCenterMarker(phase: TimerPhase, pulse: number, palette: PhasePalette): string {
	if (phase === "paused") {
		const opacity = (0.68 + pulse * 0.25).toFixed(2);
		return `
  <rect x="43.5" y="40.5" width="4.8" height="19" rx="2.4" fill="${palette.accentStart}" opacity="${opacity}" />
  <rect x="51.7" y="40.5" width="4.8" height="19" rx="2.4" fill="${palette.accentEnd}" opacity="${opacity}" />`.trim();
	}

	if (phase === "finished") {
		const opacity = (0.80 + pulse * 0.18).toFixed(2);
		return `<path d="M40.5 50.8l6.1 6.1 12.9-14.6" fill="none" stroke="${palette.accentStart}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
	}

	if (phase === "running") {
		return `<path d="M45.2 39.8l14.2 10.2-14.2 10.2z" fill="${palette.accentStart}" opacity="0.95" />`;
	}

	return `<circle cx="50" cy="50" r="5.2" fill="${palette.accentStart}" opacity="0.92" />`;
}

function getPulse(phase: TimerPhase, nowMs: number): number {
	if (phase === "paused") {
		return (Math.sin(nowMs / 340) + 1) / 2;
	}

	if (phase === "finished") {
		return (Math.sin(nowMs / 170) + 1) / 2;
	}

	return 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("\"", "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}
