import type { AdaptiveStepProfile } from "./settings";

export function getAdaptiveStepSeconds(
	profile: AdaptiveStepProfile,
	lastRotateAtMs: number | undefined,
	nowMs: number,
	ticks: number,
): number {
	if (ticks === 0 || lastRotateAtMs === undefined) {
		return profile.fineStepSeconds;
	}

	const elapsedMs = Math.max(1, nowMs - lastRotateAtMs);
	const msPerTick = elapsedMs / Math.max(1, Math.abs(ticks));

	if (msPerTick >= profile.fineThresholdMsPerTick) {
		return profile.fineStepSeconds;
	}

	if (msPerTick >= profile.mediumThresholdMsPerTick) {
		return profile.mediumStepSeconds;
	}

	if (msPerTick >= profile.fastThresholdMsPerTick) {
		return profile.fastStepSeconds;
	}

	return profile.veryFastStepSeconds;
}

export function formatStepValue(secondsPerTick: number): string {
	if (secondsPerTick >= 60 && secondsPerTick % 60 === 0) {
		return `${secondsPerTick / 60}m`;
	}

	return `${secondsPerTick}s`;
}
