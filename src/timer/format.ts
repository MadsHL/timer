function pad(value: number): string {
	return value.toString().padStart(2, "0");
}

export function formatRemainingTime(remainingMs: number): string {
	const totalSeconds = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
