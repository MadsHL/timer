export type TimerPhase = "idle" | "running" | "paused" | "finished";

export type TimerSoundChoice = "Glass" | "Hero" | "Ping" | "Submarine";

export type AdaptiveStepProfile = {
	fastStepSeconds: number;
	fastThresholdMsPerTick: number;
	fineStepSeconds: number;
	fineThresholdMsPerTick: number;
	mediumStepSeconds: number;
	mediumThresholdMsPerTick: number;
	veryFastStepSeconds: number;
};

export type AdaptiveDialTimerSettings = {
	completedAtMs?: number;
	defaultStartMinutes?: number;
	fastStepSeconds?: number;
	fastThresholdMsPerTick?: number;
	fineStepSeconds?: number;
	fineThresholdMsPerTick?: number;
	longPressThresholdMs?: number;
	maxDurationMinutes?: number;
	mediumStepSeconds?: number;
	mediumThresholdMsPerTick?: number;
	phase?: TimerPhase;
	remainingMs?: number;
	runEndsAtMs?: number;
	soundChoice?: TimerSoundChoice;
	soundEnabled?: boolean;
	soundRepeatCount?: number;
	totalDurationMs?: number;
	veryFastStepSeconds?: number;
};

export type NormalizedTimerSettings = AdaptiveStepProfile & {
	completedAtMs?: number;
	defaultStartMinutes: number;
	longPressThresholdMs: number;
	maxDurationMinutes: number;
	phase?: TimerPhase;
	remainingMs?: number;
	runEndsAtMs?: number;
	soundChoice: TimerSoundChoice;
	soundEnabled: boolean;
	soundRepeatCount: number;
	totalDurationMs?: number;
};

const DEFAULT_LONG_PRESS_THRESHOLD_MS = 800;
const DEFAULT_MAX_DURATION_MINUTES = 12 * 60;
const DEFAULT_SOUND_CHOICE: TimerSoundChoice = "Glass";
const DEFAULT_SOUND_REPEAT_COUNT = 1;
const SOUND_CHOICES: TimerSoundChoice[] = ["Glass", "Hero", "Ping", "Submarine"];
const DEFAULT_FINE_STEP_SECONDS = 1;
const DEFAULT_MEDIUM_STEP_SECONDS = 10;
const DEFAULT_FAST_STEP_SECONDS = 30;
const DEFAULT_VERY_FAST_STEP_SECONDS = 60;
const DEFAULT_FINE_THRESHOLD_MS_PER_TICK = 480;
const DEFAULT_MEDIUM_THRESHOLD_MS_PER_TICK = 220;
const DEFAULT_FAST_THRESHOLD_MS_PER_TICK = 100;

export function hasStoredRuntime(settings: AdaptiveDialTimerSettings | NormalizedTimerSettings): boolean {
	return (
		settings.phase !== undefined ||
		settings.remainingMs !== undefined ||
		settings.totalDurationMs !== undefined ||
		settings.runEndsAtMs !== undefined ||
		settings.completedAtMs !== undefined
	);
}

export function withSettingsDefaults(settings: AdaptiveDialTimerSettings = {}): NormalizedTimerSettings {
	const soundChoice = SOUND_CHOICES.includes(settings.soundChoice ?? DEFAULT_SOUND_CHOICE)
		? (settings.soundChoice ?? DEFAULT_SOUND_CHOICE)
		: DEFAULT_SOUND_CHOICE;
	const fineStepSeconds = clampInteger(settings.fineStepSeconds, 1, 60, DEFAULT_FINE_STEP_SECONDS);
	const mediumStepSeconds = clampInteger(settings.mediumStepSeconds, fineStepSeconds + 1, 300, DEFAULT_MEDIUM_STEP_SECONDS);
	const fastStepSeconds = clampInteger(settings.fastStepSeconds, mediumStepSeconds + 1, 900, DEFAULT_FAST_STEP_SECONDS);
	const veryFastStepSeconds = clampInteger(settings.veryFastStepSeconds, fastStepSeconds + 1, 1800, DEFAULT_VERY_FAST_STEP_SECONDS);
	const fineThresholdMsPerTick = clampInteger(settings.fineThresholdMsPerTick, 260, 1000, DEFAULT_FINE_THRESHOLD_MS_PER_TICK);
	const mediumThresholdMsPerTick = clampInteger(settings.mediumThresholdMsPerTick, 120, fineThresholdMsPerTick - 20, DEFAULT_MEDIUM_THRESHOLD_MS_PER_TICK);
	const fastThresholdMsPerTick = clampInteger(settings.fastThresholdMsPerTick, 40, mediumThresholdMsPerTick - 20, DEFAULT_FAST_THRESHOLD_MS_PER_TICK);

	return {
		completedAtMs: toPositiveInteger(settings.completedAtMs),
		defaultStartMinutes: clampInteger(settings.defaultStartMinutes, 0, DEFAULT_MAX_DURATION_MINUTES, 0),
		fastStepSeconds,
		fastThresholdMsPerTick,
		fineStepSeconds,
		fineThresholdMsPerTick,
		longPressThresholdMs: clampInteger(settings.longPressThresholdMs, 700, 1200, DEFAULT_LONG_PRESS_THRESHOLD_MS),
		maxDurationMinutes: clampInteger(settings.maxDurationMinutes, 15, DEFAULT_MAX_DURATION_MINUTES, DEFAULT_MAX_DURATION_MINUTES),
		mediumStepSeconds,
		mediumThresholdMsPerTick,
		phase: parsePhase(settings.phase),
		remainingMs: toPositiveInteger(settings.remainingMs),
		runEndsAtMs: toPositiveInteger(settings.runEndsAtMs),
		soundChoice,
		soundEnabled: parseBoolean(settings.soundEnabled, true),
		soundRepeatCount: clampInteger(settings.soundRepeatCount, 1, 10, DEFAULT_SOUND_REPEAT_COUNT),
		totalDurationMs: toPositiveInteger(settings.totalDurationMs),
		veryFastStepSeconds,
	};
}

export function getDefaultStartMs(settings: Pick<NormalizedTimerSettings, "defaultStartMinutes">): number {
	return settings.defaultStartMinutes * 60_000;
}

export function getAdaptiveStepProfile(settings: Pick<
	NormalizedTimerSettings,
	| "fastStepSeconds"
	| "fastThresholdMsPerTick"
	| "fineStepSeconds"
	| "fineThresholdMsPerTick"
	| "mediumStepSeconds"
	| "mediumThresholdMsPerTick"
	| "veryFastStepSeconds"
>): AdaptiveStepProfile {
	return {
		fastStepSeconds: settings.fastStepSeconds,
		fastThresholdMsPerTick: settings.fastThresholdMsPerTick,
		fineStepSeconds: settings.fineStepSeconds,
		fineThresholdMsPerTick: settings.fineThresholdMsPerTick,
		mediumStepSeconds: settings.mediumStepSeconds,
		mediumThresholdMsPerTick: settings.mediumThresholdMsPerTick,
		veryFastStepSeconds: settings.veryFastStepSeconds,
	};
}

export function getMaxDurationMs(settings: Pick<NormalizedTimerSettings, "maxDurationMinutes">): number {
	return settings.maxDurationMinutes * 60_000;
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
	const numericValue = toFiniteNumber(value);
	if (numericValue === undefined) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, Math.round(numericValue)));
}

function parsePhase(value: TimerPhase | undefined): TimerPhase | undefined {
	switch (value) {
		case "idle":
		case "running":
		case "paused":
		case "finished":
			return value;
		default:
			return undefined;
	}
}

function toPositiveInteger(value: unknown): number | undefined {
	const numericValue = toFiniteNumber(value);
	if (numericValue === undefined) {
		return undefined;
	}

	return Math.max(0, Math.round(numericValue));
}

function parseBoolean(value: boolean | undefined, fallback: boolean): boolean {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "string") {
		if (value === "true") {
			return true;
		}

		if (value === "false") {
			return false;
		}
	}

	return fallback;
}

function toFiniteNumber(value: unknown): number | undefined {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : undefined;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return undefined;
}
