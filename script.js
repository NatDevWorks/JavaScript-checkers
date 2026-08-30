document.addEventListener('DOMContentLoaded', () => {
	const boardEl = document.getElementById('board');
	const statusEl = document.getElementById('status');
	const resetBtn = document.getElementById('resetBtn');
	const modeSelect = document.getElementById('modeSelect');

	if (!boardEl || !statusEl || !resetBtn || !modeSelect) return;

	const SIZE = 8;
	const CELL_SIZE = 60;
	const AI_COLOR = 'black';
	const HUMAN_COLOR = 'red';
	const AI_MOVE_DELAY = 700;

	let selected = null;
	let forcedCaptureCell = null;
	let currentTurn = 'red';
	let aiThinking = false;
	let gameOver = false;

	boardEl.style.display = 'grid';
	boardEl.style.gridTemplateColumns = `repeat(${SIZE}, ${CELL_SIZE}px)`;
	boardEl.style.gridTemplateRows = `repeat(${SIZE}, ${CELL_SIZE}px)`;
	boardEl.style.width = 'max-content';
	boardEl.style.height = 'max-content';

	resetBtn.addEventListener('click', startGame);
	modeSelect.addEventListener('change', startGame);

	startGame();

	function startGame() {
		selected = null;
		forcedCaptureCell = null;
		aiThinking = false;
		gameOver = false;
		clearAiHighlights();
		currentTurn = getFirstTurn();
		buildBoard();
		updateStatus();

		if (isAiTurn()) {
			queueAiMove();
		}
	}

	function getFirstTurn() {
		return Math.random() < 0.5 ? 'red' : 'black';
	}

	function buildBoard() {
		boardEl.innerHTML = '';

		for (let r = 0; r < SIZE; r++) {
			for (let c = 0; c < SIZE; c++) {
				const cell = document.createElement('div');
				const dark = isDarkSquare(r, c);

				cell.className = 'cell';
				cell.dataset.row = r;
				cell.dataset.col = c;
				cell.style.width = `${CELL_SIZE}px`;
				cell.style.height = `${CELL_SIZE}px`;
				cell.style.boxSizing = 'border-box';
				cell.style.border = '1px solid #444';
				cell.style.display = 'flex';
				cell.style.alignItems = 'center';
				cell.style.justifyContent = 'center';
				cell.style.background = dark ? '#769656' : '#eeeed2';
				cell.style.cursor = dark ? 'pointer' : 'default';

				if (dark && (r < 3 || r > 4)) {
					cell.appendChild(createPiece(r < 3 ? 'black' : 'red'));
				}

				cell.addEventListener('click', () => onCellClick(cell));
				boardEl.appendChild(cell);
			}
		}
	}

	function createPiece(color) {
		const piece = document.createElement('div');

		piece.className = 'piece';
		piece.dataset.color = color;
		piece.dataset.king = 'false';
		piece.style.width = '36px';
		piece.style.height = '36px';
		piece.style.borderRadius = '50%';
		piece.style.boxShadow = 'inset 0 0 4px rgba(0,0,0,0.3)';
		piece.style.background = color === 'black' ? '#222' : '#b30000';

		return piece;
	}

	function onCellClick(cell) {
		if (gameOver || aiThinking || isAiTurn()) return;

		const row = Number(cell.dataset.row);
		const col = Number(cell.dataset.col);
		if (!isDarkSquare(row, col)) return;

		const piece = cell.querySelector('.piece');

		if (selected) {
			const move = getMove(selected, cell, currentTurn);

			if (move) {
				const movedPiece = movePiece(selected, cell, move.capturedCell);
				makeKingIfNeeded(movedPiece, cell);

				if (move.isCapture && getCaptureMoves(cell, currentTurn).length > 0) {
					forcedCaptureCell = cell;
					selectCell(cell);
					updateStatus(`${getPlayerName(currentTurn)} can capture again`);
					return;
				}

				forcedCaptureCell = null;
				clearSelection();
				endTurn();
				return;
			}

			if (!forcedCaptureCell) {
				clearSelection();
			}
		}

		if (piece && piece.dataset.color === currentTurn && (!forcedCaptureCell || cell === forcedCaptureCell)) {
			selectCell(cell);
		}
	}

	function selectCell(cell) {
		clearSelection();
		selected = cell;
		cell.classList.add('selected');
	}

	function clearSelection() {
		if (selected) selected.classList.remove('selected');
		selected = null;
	}

	function movePiece(fromCell, toCell, capturedCell = null) {
		const moved = fromCell.querySelector('.piece');
		if (moved) {
			if (capturedCell) {
				capturedCell.innerHTML = '';
			}

			toCell.appendChild(moved);
		}

		return moved;
	}

	function endTurn() {
		forcedCaptureCell = null;
		currentTurn = currentTurn === 'red' ? 'black' : 'red';

		if (checkWinner()) return;

		updateStatus();

		if (isAiTurn()) {
			queueAiMove();
		}
	}

	function queueAiMove() {
		if (gameOver) return;

		aiThinking = true;
		updateStatus('AI is thinking...');

		setTimeout(async () => {
			await makeAiTurn();
			aiThinking = false;
			await wait(300);
			clearAiHighlights();
			endTurn();
		}, 600);
	}

	// AI turn logic: choose a legal move for the computer, prioritizing captures first.
	async function makeAiTurn() {
		// Look for all capture moves available to the AI before doing regular steps.
		let moves = getCaptureMovesForColor(AI_COLOR);

		// If no captures are possible, fall back to ordinary movement.
		if (moves.length === 0) {
			moves = getStepMovesForColor(AI_COLOR);
		}

		// If there are no valid moves at all, the AI cannot act.
		if (moves.length === 0) return;

		// Pick one move at random from the available options.
		let move = getRandomMove(moves);
		showAiMove(move);
		let movedPiece = movePiece(move.from, move.to, move.capturedCell);
		makeKingIfNeeded(movedPiece, move.to);

		// If the selected move was a capture, continue chaining additional captures.
		while (move.isCapture) {
			const nextCaptures = getCaptureMoves(move.to, AI_COLOR);
			if (nextCaptures.length === 0) break;

			updateStatus('AI can capture again...');
			await wait(AI_MOVE_DELAY);
			move = getRandomMove(nextCaptures);
			showAiMove(move);
			movedPiece = movePiece(move.from, move.to, move.capturedCell);
			makeKingIfNeeded(movedPiece, move.to);
		}
	}

	// Highlight the source and destination cells for the AI's chosen move.
	function showAiMove(move) {
		clearAiHighlights();
		move.from.classList.add('ai-from');
		move.to.classList.add('ai-to');
	}

	// Remove any AI movement highlights from the board.
	function clearAiHighlights() {
		boardEl.querySelectorAll('.ai-from, .ai-to').forEach((cell) => {
			cell.classList.remove('ai-from', 'ai-to');
		});
	}

	// Simple delay helper used to pace AI turns and animations.
	function wait(milliseconds) {
		return new Promise((resolve) => {
			setTimeout(resolve, milliseconds);
		});
	}

	// Collect all possible non-capture moves for a specific color.
	function getStepMovesForColor(color) {
		const moves = [];
		const pieces = [...boardEl.querySelectorAll(`.piece[data-color="${color}"]`)];

		pieces.forEach((piece) => {
			const from = piece.parentElement;
			moves.push(...getStepMoves(from, color));
		});

		return moves;
	}

	// Collect all possible capture moves for a specific color.
	function getCaptureMovesForColor(color) {
		const moves = [];
		const pieces = [...boardEl.querySelectorAll(`.piece[data-color="${color}"]`)];

		pieces.forEach((piece) => {
			const from = piece.parentElement;
			moves.push(...getCaptureMoves(from, color));
		});

		return moves;
	}

	// Find all legal single-step moves for a piece of the given color.
	function getStepMoves(fromCell, color) {
		const moves = [];
		const row = Number(fromCell.dataset.row);
		const col = Number(fromCell.dataset.col);
		const directions = getMoveDirections(fromCell, color);

		directions.forEach((rowStep) => {
			[-1, 1].forEach((colStep) => {
				const to = getCell(row + rowStep, col + colStep);

				if (to && !to.querySelector('.piece')) {
					moves.push({ from: fromCell, to, capturedCell: null, isCapture: false });
				}
			});
		});

		return moves;
	}

	// Find all legal capture jumps for a piece of the given color.
	function getCaptureMoves(fromCell, color) {
		const moves = [];
		const row = Number(fromCell.dataset.row);
		const col = Number(fromCell.dataset.col);
		const directions = getMoveDirections(fromCell, color);

		directions.forEach((rowStep) => {
			[-1, 1].forEach((colStep) => {
				const middleCell = getCell(row + rowStep, col + colStep);
				const landingCell = getCell(row + rowStep * 2, col + colStep * 2);
				const middlePiece = middleCell?.querySelector('.piece');

				if (
					landingCell &&
					!landingCell.querySelector('.piece') &&
					middlePiece &&
					middlePiece.dataset.color !== color
				) {
					moves.push({ from: fromCell, to: landingCell, capturedCell: middleCell, isCapture: true });
				}
			});
		});

		return moves;
	}

	// Validate whether a candidate move is legal for the specified color and destination cell.
	function getMove(fromCell, toCell, color) {
		const piece = fromCell.querySelector('.piece');
		if (!piece || piece.dataset.color !== color || toCell.querySelector('.piece')) return null;

		const availableMoves = forcedCaptureCell
			? getCaptureMoves(fromCell, color)
			: [...getCaptureMoves(fromCell, color), ...getStepMoves(fromCell, color)];

		return availableMoves.find((move) => move.to === toCell) || null;
	}

	// Pick a random move from a list of legal options.
	function getRandomMove(moves) {
		return moves[Math.floor(Math.random() * moves.length)];
	}

	// Convert a color name like 'black' into a display label like 'Black'.
	function getPlayerName(color) {
		return color[0].toUpperCase() + color.slice(1);
	}

	function getMoveDirection(color) {
		return color === 'red' ? -1 : 1;
	}

	function getMoveDirections(fromCell, color) {
		const piece = fromCell.querySelector('.piece');
		return piece?.dataset.king === 'true' ? [-1, 1] : [getMoveDirection(color)];
	}

	function makeKingIfNeeded(piece, cell) {
		if (!piece || piece.dataset.king === 'true') return;

		const row = Number(cell.dataset.row);
		const redReachedKingRow = piece.dataset.color === 'red' && row === 0;
		const blackReachedKingRow = piece.dataset.color === 'black' && row === SIZE - 1;

		if (redReachedKingRow || blackReachedKingRow) {
			piece.dataset.king = 'true';
			piece.classList.add('king');
			piece.textContent = 'K';
		}
	}

	function checkWinner() {
		const redCanMove = canPlayerMove('red');
		const blackCanMove = canPlayerMove('black');

		if (!redCanMove) {
			declareWinner('black');
			return true;
		}

		if (!blackCanMove) {
			declareWinner('red');
			return true;
		}

		return false;
	}

	function canPlayerMove(color) {
		const pieceCount = boardEl.querySelectorAll(`.piece[data-color="${color}"]`).length;
		return pieceCount > 0 && (getCaptureMovesForColor(color).length > 0 || getStepMovesForColor(color).length > 0);
	}

	function declareWinner(color) {
		gameOver = true;
		aiThinking = false;
		clearSelection();
		clearAiHighlights();
		statusEl.textContent = `${getPlayerName(color)} wins!`;
	}

	function getCell(row, col) {
		return boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
	}

	function isDarkSquare(row, col) {
		return (row + col) % 2 === 1;
	}

	function isAiTurn() {
		return modeSelect.value === 'ai' && currentTurn === AI_COLOR;
	}

	function updateStatus(message) {
		if (message) {
			statusEl.textContent = message;
			return;
		}

		const player = getPlayerName(currentTurn);

		if (modeSelect.value === 'ai') {
			statusEl.textContent = currentTurn === HUMAN_COLOR ? "Your turn" : "AI's turn";
			return;
		}

		statusEl.textContent = `${player}'s turn`;
	}
});
