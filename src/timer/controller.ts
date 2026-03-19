import type { DialAction } from "@elgato/streamdeck";

import { formatStepValue, getAdaptiveStepSeconds } from "./adaptive-step";
import { formatRemainingTime } from "./format";
import { renderTimerSvg } from "./render";
import { getAdaptiveStepProfile, type AdaptiveDialTimerSettings, getMaxDurationMs, hasStoredRuntime, type NormalizedTimerSettings, withSettingsDefaults } from "./settings";
import { MacOsSoundPlayer } from "./sound";
import { finishTimer, getCurrentRemainingMs, isAnimatedPhase, resetTimerState, restoreTimerState, type TimerState, toggleRunningState, withRotation } from "./state";

export class AdaptiveDialTimerController {
	private action?: DialAction<AdaptiveDialTimerSettings>;
	private visible = false;
	private settings: NormalizedTimerSettings;
	private state: TimerState;
	private loopHandle?: NodeJS.Timeout;
	private pressStartedAtMs?: number;
	private pressRotated = false;
	private lastRotateAtMs?: number;
	private transientHint?: string;
	private transientHintExpiresAtMs?: number;
	private disposed = false;

	constructor(
		private readonly id: string,
		settings: AdaptiveDialTimerSettings,
		private readonly soundPlayer: MacOsSoundPlayer,
		private readonly release: (id: string) => void,
	) {
		this.settings = withSettingsDefaults(settings);
		this.state = restoreTimerState(this.settings, Date.now());
	}

	async attach(action: DialAction<AdaptiveDialTimerSettings>, settings: AdaptiveDialTimerSettings): Promise<void> {
		this.action = action;
		this.visible = true;
		this.settings = withSettingsDefaults(settings);
		this.state = restoreTimerState(this.settings, Date.now());

		await this.action.setFeedbackLayout("layouts/adaptive-dial-timer.json");
		await this.action.setTriggerDescription({
			longTouch: "Reset timer",
			push: "Start, pause, resume, stop sound, or reset",
			rotate: "Adjust time with adaptive steps",
		});

		if (!hasStoredRuntime(settings) || (settings.phase === "running" && this.state.phase === "finished")) {
			await this.persistState();
		}

		await this.render(Date.now());
		this.syncLoop();
	}

	detach(): void {
		this.visible = false;
		this.syncLoop();
	}

	dispose(): void {
		this.disposed = true;
		this.clearLoop();
	}

	updateConfiguration(settings: AdaptiveDialTimerSettings): void {
		const normalized = withSettingsDefaults(settings);
		this.settings = {
			...this.settings,
			defaultStartMinutes: normalized.defaultStartMinutes,
			fastStepSeconds: normalized.fastStepSeconds,
			fastThresholdMsPerTick: normalized.fastThresholdMsPerTick,
			fineStepSeconds: normalized.fineStepSeconds,
			fineThresholdMsPerTick: normalized.fineThresholdMsPerTick,
			longPressThresholdMs: normalized.longPressThresholdMs,
			maxDurationMinutes: normalized.maxDurationMinutes,
			mediumStepSeconds: normalized.mediumStepSeconds,
			mediumThresholdMsPerTick: normalized.mediumThresholdMsPerTick,
			soundChoice: normalized.soundChoice,
			soundEnabled: normalized.soundEnabled,
			soundRepeatCount: normalized.soundRepeatCount,
			veryFastStepSeconds: normalized.veryFastStepSeconds,
		};
	}

	async applySettings(settings: AdaptiveDialTimerSettings): Promise<void> {
		this.settings = withSettingsDefaults(settings);
		this.state = restoreTimerState(this.settings, Date.now());
		if (!this.settings.soundEnabled || this.state.phase !== "finished") {
			this.stopCompletionSound();
		}

		await this.persistState();
		await this.render(Date.now());
		this.syncLoop();
	}

	onDialDown(): void {
		this.pressStartedAtMs = Date.now();
		this.pressRotated = false;
	}

	async onDialRotate(ticks: number, pressed: boolean): Promise<void> {
		if (ticks === 0) {
			return;
		}

		const nowMs = Date.now();
		if (this.isCompletionSoundPlaying()) {
			this.stopCompletionSound();
		}
		const stepSeconds = getAdaptiveStepSeconds(getAdaptiveStepProfile(this.settings), this.lastRotateAtMs, nowMs, ticks);
		const stepMs = stepSeconds * 1000;
		this.lastRotateAtMs = nowMs;
		this.pressRotated ||= pressed || this.pressStartedAtMs !== undefined;
		this.transientHint = `${ticks > 0 ? "+" : "-"}${formatStepValue(stepSeconds)} / notch`;
		this.transientHintExpiresAtMs = nowMs + 1600;
		this.state = withRotation(this.state, stepMs, ticks, getMaxDurationMs(this.settings), nowMs);

		await this.persistState();
		await this.render(nowMs);
		this.syncLoop();
	}

	async onDialUp(): Promise<void> {
		if (this.pressStartedAtMs === undefined) {
			return;
		}

		const nowMs = Date.now();
		const pressDurationMs = nowMs - this.pressStartedAtMs;
		const rotatedDuringPress = this.pressRotated;

		this.pressStartedAtMs = undefined;
		this.pressRotated = false;

		if (rotatedDuringPress) {
			return;
		}

		if (this.state.phase === "finished") {
			if (this.isCompletionSoundPlaying()) {
				this.stopCompletionSound();
				await this.render(nowMs);
				this.syncLoop();
				return;
			}

			await this.reset(nowMs);
			return;
		}

		if (pressDurationMs >= this.settings.longPressThresholdMs) {
			await this.reset(nowMs);
			return;
		}

		const nextState = toggleRunningState(this.state, nowMs);
		if (nextState === this.state) {
			return;
		}

		this.state = nextState;
		await this.persistState();
		await this.render(nowMs);
		this.syncLoop();
	}

	private async onLoop(): Promise<void> {
		this.loopHandle = undefined;
		if (this.disposed) {
			return;
		}

		const nowMs = Date.now();
		if (this.state.phase === "running" && getCurrentRemainingMs(this.state, nowMs) <= 0) {
			await this.finish(nowMs);
			return;
		}

		if (this.visible) {
			await this.render(nowMs);
		}

		this.syncLoop();
	}

	private syncLoop(): void {
		this.clearLoop();
		if (this.disposed) {
			return;
		}

		const shouldAnimate = this.state.phase === "running" || (this.visible && isAnimatedPhase(this.state.phase));
		if (!shouldAnimate) {
			this.releaseIfUnused();
			return;
		}

		const delayMs = this.state.phase === "running" ? 200 : 320;
		this.loopHandle = setTimeout(() => {
			void this.onLoop();
		}, delayMs);
	}

	private clearLoop(): void {
		if (this.loopHandle) {
			clearTimeout(this.loopHandle);
			this.loopHandle = undefined;
		}
	}

	private async finish(nowMs: number): Promise<void> {
		const wasFinished = this.state.phase === "finished";
		this.state = finishTimer(this.state, nowMs);

		await this.persistState();

		if (!wasFinished && this.settings.soundEnabled) {
			this.soundPlayer.playRepeated(this.id, this.settings.soundChoice, this.settings.soundRepeatCount);
		}

		await this.render(nowMs);
		this.syncLoop();
	}

	private async reset(nowMs: number): Promise<void> {
		this.stopCompletionSound();
		this.state = resetTimerState();
		this.transientHint = undefined;
		this.transientHintExpiresAtMs = undefined;

		await this.persistState();
		await this.render(nowMs);
		this.syncLoop();
	}

	private async persistState(): Promise<void> {
		if (!this.action) {
			return;
		}

		const settings: AdaptiveDialTimerSettings = {
			...this.settings,
			completedAtMs: this.state.phase === "finished" ? this.state.completedAtMs : undefined,
			phase: this.state.phase,
			remainingMs: this.state.phase === "running" ? getCurrentRemainingMs(this.state, Date.now()) : this.state.remainingMs,
			runEndsAtMs: this.state.phase === "running" ? this.state.runEndsAtMs : undefined,
			totalDurationMs: this.state.totalDurationMs,
		};

		await this.action.setSettings(settings);
	}

	private async render(nowMs: number): Promise<void> {
		if (!this.visible || !this.action) {
			return;
		}

		const remainingMs = getCurrentRemainingMs(this.state, nowMs);
		const hintText = this.getHintText(nowMs);
		const statusText = this.getStatusText();

		await this.action.setFeedback({
			visual: renderTimerSvg({
				hintText,
				nowMs,
				phase: this.state.phase,
				remainingMs,
				statusText,
				timeText: formatRemainingTime(remainingMs),
				totalDurationMs: this.state.totalDurationMs,
			}),
		});
	}

	private getHintText(nowMs: number): string {
		if (this.transientHint && this.transientHintExpiresAtMs && this.transientHintExpiresAtMs > nowMs) {
			return this.transientHint;
		}

		switch (this.state.phase) {
			case "running":
				return "Press to pause";
			case "paused":
				return "Press to resume";
			case "finished":
				return this.isCompletionSoundPlaying() ? "Press to stop sound" : "Press to reset";
			case "idle":
			default:
				return this.state.remainingMs > 0 ? "Press to start" : "Rotate to set";
		}
	}

	private getStatusText(): string {
		switch (this.state.phase) {
			case "running":
				return "Running";
			case "paused":
				return "Paused";
			case "finished":
				return this.isCompletionSoundPlaying() ? "Alert" : "Complete";
			case "idle":
			default:
				return this.state.remainingMs > 0 ? "Ready" : "Set timer";
		}
	}

	private isCompletionSoundPlaying(): boolean {
		return this.soundPlayer.isPlaying(this.id);
	}

	private stopCompletionSound(): void {
		this.soundPlayer.stop(this.id);
	}

	private releaseIfUnused(): void {
		if (this.visible || this.state.phase === "running") {
			return;
		}

		this.release(this.id);
	}
}
