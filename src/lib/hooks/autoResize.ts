export function autoResize(textarea: HTMLTextAreaElement, maxHeight = 200) {
	const resize = () => {
		textarea.style.height = 'auto';
		textarea.style.overflowY = 'hidden';

		const newHeight = textarea.scrollHeight;
		if (newHeight <= maxHeight) {
			textarea.style.height = `${newHeight}px`;
		} else {
			textarea.style.height = `${maxHeight}px`;
			textarea.style.overflowY = 'auto';
		}
	};

	textarea.addEventListener('input', resize);
	resize();

	return {
		destroy() {
			textarea.removeEventListener('input', resize);
		}
	};
}
