(() => {
  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  const scoreNode = document.querySelector('#score');
  const state = { x: 16, y: 48, score: 0, starX: 100, starY: 48 };
  function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#38bdf8'; context.fillRect(state.x, state.y, 18, 18);
    context.fillStyle = '#facc15'; context.beginPath(); context.arc(state.starX, state.starY, 8, 0, Math.PI * 2); context.fill();
    scoreNode.textContent = String(state.score);
  }
  document.querySelector('#right').addEventListener('click', () => { state.x = Math.min(canvas.width - 18, state.x + 16); render(); });
  document.querySelector('#collect').addEventListener('click', () => {
    if (Math.abs((state.x + 9) - state.starX) <= 18 && Math.abs((state.y + 9) - state.starY) <= 18) {
      state.score += 1; state.starX = Math.min(canvas.width - 12, state.starX + 56); render();
    }
  });
  document.querySelector('#reset').addEventListener('click', () => { state.x = 16; state.score = 0; state.starX = 100; render(); });
  window.__round10Game = { state, render };
  render();
})();
