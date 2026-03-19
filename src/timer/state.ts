import { getDefaultStartMs, getMaxDurationMs, type NormalizedTimerSettings, type TimerPhase } from "./settings";

export type TimerState = {
	completedAtMs?: number;
	phase: TimerPhase;
	remainingMs: number;
	runEndsAtMs?: number;
	totalDurationMs: number;
};

export function restoreTimerState(settings: NormalizedTimerSettings, nowMs = Date.now()): TimerState {
	const maxDurationMs = getMaxDurationMs(settings);
	const defaultStartMs = getDefaultStartMs(settings);
	const fallbackRemainingMs = clampDuration(settings.remainingMs ?? settings.totalDurationMs ?? defaultStartMs, maxDurationMs);
	const fallbackTotalDurationMs = settings.phase === "idle"
		? fallbackRemainingMs
		: Math.max(fallbackRemainingMs, settings.totalDurationMs ?? fallbackRemainingMs);

	switch (settings.phase) {
		case "running": {
			const runEndsAtMs = settings.runEndsAtMs ?? nowMs;
			if (runEndsAtMs <= nowMs || fallbackRemainingMs <= 0) {
				return {
					completedAtMs: settings.completedAtMs ?? runEndsAtMs,
					phase: "finished",
					remainingMs: 0,
					totalDurationMs: Math.max(fallbackTotalDurationMs, 0),
				};
			}

			const liveRemainingMs = clampDuration(runEndsAtMs - nowMs, maxDurationMs);

			return {
				phase: "running",
				remainingMs: liveRemainingMs,
				runEndsAtMs: nowMs + liveRemainingMs,
				totalDurationMs: Math.max(fallbackTotalDurationMs, liveRemainingMs),
			};
		}
		case "paused":
			return fallbackRemainingMs > 0
				? {
						phase: "paused",
						remainingMs: fallbackRemainingMs,
						totalDurationMs: Math.max(fallbackTotalDurationMs, fallbackRemainingMs),
					}
				: resetTimerState();
		case "finished":
			return {
				completedAtMs: settings.completedAtMs ?? nowMs,
				phase: "finished",
				remainingMs: 0,
				totalDurationMs: Math.max(fallbackTotalDurationMs, 0),
			};
		case "idle":
		default:
			return fallbackRemainingMs > 0
				? {
						phase: "idle",
						remainingMs: fallbackRemainingMs,
						totalDurationMs: fallbackRemainingMs,
					}
				: resetTimerState();
	}
}

export function getCurrentRemainingMs(state: TimerState, nowMs = Date.now()): number {
	if (state.phase !== "running") {
		return state.remainingMs;
	}

	return Math.max(0, (state.runEndsAtMs ?? nowMs) - nowMs);
}

export function toggleRunningState(state: TimerState, nowMs = Date.now()): TimerState {
	const currentRemainingMs = getCurrentRemainingMs(state, nowMs);
	if (currentRemainingMs <= 0 || state.phase === "finished") {
		return state;
	}

	switch (state.phase) {
		case "running":
			return {
				phase: "paused",
				remainingMs: currentRemainingMs,
				totalDurationMs: Math.max(state.totalDurationMs, currentRemainingMs),
			};
		case "paused":
		case "idle":
			return {
				phase: "running",
				remainingMs: currentRemainingMs,
				runEndsAtMs: nowMs + currentRemainingMs,
				totalDurationMs: Math.max(state.totalDurationMs, currentRemainingMs),
			};
		default:
			return state;
	}
}

export function withRotation(state: TimerState, stepMs: number, ticks: number, maxDurationMs: number, nowMs = Date.now()): TimerState {
	const currentRemainingMs = getCurrentRemainingMs(state, nowMs);
	const nextRemainingMs = clampDuration(getRotatedRemainingMs(currentRemainingMs, stepMs, ticks), maxDurationMs);

	if (nextRemainingMs <= 0) {
		return resetTimerState();
	}

	if (state.phase === "running" || state.phase === "paused") {
		const elapsedMs = Math.max(0, state.totalDurationMs - currentRemainingMs);
		const nextTotalDurationMs = Math.max(nextRemainingMs, elapsedMs + nextRemainingMs);

		return state.phase === "running"
			? {
					phase: "running",
					remainingMs: nextRemainingMs,
					runEndsAtMs: nowMs + nextRemainingMs,
					totalDurationMs: nextTotalDurationMs,
				}
			: {
					phase: "paused",
					remainingMs: nextRemainingMs,
					totalDurationMs: nextTotalDurationMs,
				};
	}

	return {
		phase: "idle",
		remainingMs: nextRemainingMs,
		totalDurationMs: nextRemainingMs,
	};
}

export function finishTimer(state: TimerState, nowMs = Date.now()): TimerState {
	return {
		completedAtMs: state.completedAtMs ?? nowMs,
		phase: "finished",
		remainingMs: 0,
		totalDurationMs: Math.max(state.totalDurationMs, getCurrentRemainingMs(state, nowMs)),
	};
}

export function resetTimerState(): TimerState {
	return {
		phase: "idle",
		remainingMs: 0,
		totalDurationMs: 0,
	};
}

export function isAnimatedPhase(phase: TimerPhase): boolean {
	return phase === "running" || phase === "paused" || phase === "finished";
}

function clampDuration(value: number, maximum: number): number {
	return Math.min(maximum, Math.max(0, Math.round(value)));
}

function getRotatedRemainingMs(currentRemainingMs: number, stepMs: number, ticks: number): number {
	if (ticks === 0) {
		return currentRemainingMs;
	}

	if (stepMs <= 1000) {
		return currentRemainingMs + stepMs * ticks;
	}

	const stepCount = Math.abs(ticks);
	const direction = Math.sign(ticks);
	const remainder = currentRemainingMs % stepMs;

	if (direction > 0) {
		const firstStepTarget = remainder === 0
			? currentRemainingMs + stepMs
			: currentRemainingMs + (stepMs - remainder);

		return firstStepTarget + stepMs * (stepCount - 1);
	}

	const firstStepTarget = remainder === 0
		? currentRemainingMs - stepMs
		: currentRemainingMs - remainder;

	return firstStepTarget - stepMs * (stepCount - 1);
}
