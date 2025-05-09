<style>
:global(body) {
	margin: 0;
	font-family: 'Segoe UI', sans-serif;
	background-color: #343541;
	color: #ffffff;
}

main {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 2rem;
	max-width: 720px;
	margin: 0 auto;
}

.chat-window {
	width: 100%;
	background: #444654;
	border-radius: 10px;
	padding: 1rem;
	overflow-y: auto;
	min-height: 60vh;
	margin-bottom: 1rem;
}

.message {
	display: flex;
	margin-bottom: 1rem;
	padding: 0.75rem;
	border-radius: 8px;
	white-space: pre-wrap;
}

.user {
	background: #2b8cff;
	align-self: flex-end;
	justify-content: flex-end;
}

.ai {
	background: #3e3f4b;
	align-self: flex-start;
	justify-content: flex-start;
}

textarea {
	width: 100%;
	resize: none;
	border: none;
	border-radius: 8px;
	padding: 1rem;
	font-size: 1rem;
	background: #40414f;
	color: #fff;
	margin-bottom: 0.5rem;
}

button {
	background-color: #19c37d;
	color: white;
	border: none;
	padding: 0.75rem 1.25rem;
	border-radius: 8px;
	cursor: pointer;
	font-weight: bold;
}
</style>