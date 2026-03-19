import {
	action,
	type DialDownEvent,
	type DialRotateEvent,
	type DialUpEvent,
	type DidReceiveSettingsEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { AdaptiveDialTimerController } from "../timer/controller";
import { MacOsSoundPlayer } from "../timer/sound";
import type { AdaptiveDialTimerSettings } from "../timer/settings";

@action({ UUID: "dk.dasma.timer.adaptive-dial-timer" })
export class AdaptiveDialTimer extends SingletonAction<AdaptiveDialTimerSettings> {
	private readonly controllers = new Map<string, AdaptiveDialTimerController>();
	private readonly soundPlayer = new MacOsSoundPlayer();

	override async onWillAppear(ev: WillAppearEvent<AdaptiveDialTimerSettings>): Promise<void> {
		if (!ev.action.isDial()) {
			return;
		}

		const controller = this.getOrCreateController(ev.action.id, ev.payload.settings);
		await controller.attach(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<AdaptiveDialTimerSettings>): void {
		const controller = this.controllers.get(ev.action.id);
		controller?.detach();
	}

	override onDialDown(ev: DialDownEvent<AdaptiveDialTimerSettings>): Promise<void> | void {
		const controller = this.getOrCreateController(ev.action.id, ev.payload.settings);
		controller.updateConfiguration(ev.payload.settings);

		return controller.onDialDown();
	}

	override onDialRotate(ev: DialRotateEvent<AdaptiveDialTimerSettings>): Promise<void> | void {
		const controller = this.getOrCreateController(ev.action.id, ev.payload.settings);
		controller.updateConfiguration(ev.payload.settings);

		return controller.onDialRotate(ev.payload.ticks, ev.payload.pressed);
	}

	override onDialUp(ev: DialUpEvent<AdaptiveDialTimerSettings>): Promise<void> | void {
		const controller = this.getOrCreateController(ev.action.id, ev.payload.settings);
		controller.updateConfiguration(ev.payload.settings);

		return controller.onDialUp();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<AdaptiveDialTimerSettings>): Promise<void> {
		if (!ev.action.isDial()) {
			return;
		}

		const controller = this.getOrCreateController(ev.action.id, ev.payload.settings);
		await controller.applySettings(ev.payload.settings);
	}

	private getOrCreateController(id: string, settings: AdaptiveDialTimerSettings): AdaptiveDialTimerController {
		let controller = this.controllers.get(id);
		if (!controller) {
			controller = new AdaptiveDialTimerController(id, settings, this.soundPlayer, this.releaseController);
			this.controllers.set(id, controller);
		}

		return controller;
	}

	private readonly releaseController = (id: string): void => {
		const controller = this.controllers.get(id);
		if (!controller) {
			return;
		}

		controller.dispose();
		this.controllers.delete(id);
	};
}
