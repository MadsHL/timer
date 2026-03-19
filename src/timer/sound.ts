import { spawn, type ChildProcess } from "node:child_process";

import streamDeck from "@elgato/streamdeck";

import type { TimerSoundChoice } from "./settings";

const SYSTEM_SOUND_PATHS: Record<TimerSoundChoice, string> = {
	Glass: "/System/Library/Sounds/Glass.aiff",
	Hero: "/System/Library/Sounds/Hero.aiff",
	Ping: "/System/Library/Sounds/Ping.aiff",
	Submarine: "/System/Library/Sounds/Submarine.aiff",
};

type PlaybackSession = {
	cancelled: boolean;
	child?: ChildProcess;
};

export class MacOsSoundPlayer {
	private readonly sessions = new Map<string, PlaybackSession>();

	playRepeated(id: string, choice: TimerSoundChoice, repeatCount: number): void {
		if (process.platform !== "darwin") {
			return;
		}

		const soundPath = SYSTEM_SOUND_PATHS[choice];
		if (!soundPath || repeatCount <= 0) {
			return;
		}

		this.stop(id);
		const session: PlaybackSession = { cancelled: false };
		this.sessions.set(id, session);
		void this.runSession(id, choice, soundPath, repeatCount, session);
	}

	stop(id: string): void {
		const session = this.sessions.get(id);
		if (!session) {
			return;
		}

		this.sessions.delete(id);
		session.cancelled = true;
		session.child?.kill("SIGTERM");
	}

	isPlaying(id: string): boolean {
		return this.sessions.has(id);
	}

	private async runSession(
		id: string,
		choice: TimerSoundChoice,
		soundPath: string,
		repeatCount: number,
		session: PlaybackSession,
	): Promise<void> {
		try {
			for (let index = 0; index < repeatCount && !session.cancelled; index += 1) {
				await this.playOnce(choice, soundPath, session);
			}
		} finally {
			if (this.sessions.get(id) === session) {
				this.sessions.delete(id);
			}
		}
	}

	private async playOnce(choice: TimerSoundChoice, soundPath: string, session: PlaybackSession): Promise<void> {
		await new Promise<void>((resolve) => {
			const child = spawn("afplay", [soundPath], { stdio: "ignore" });
			session.child = child;

			const finish = (): void => {
				if (session.child === child) {
					session.child = undefined;
				}
				resolve();
			};

			child.once("error", (error) => {
				if (!session.cancelled) {
					streamDeck.logger.error(`Failed to play completion sound "${choice}".`, error);
				}
				finish();
			});

			child.once("exit", (code) => {
				if (!session.cancelled && code && code !== 0) {
					streamDeck.logger.warn(`Completion sound "${choice}" exited with code ${code}.`);
				}
				finish();
			});

			child.unref();
		});
	}
}
