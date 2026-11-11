(() => {
  let count = 0;
  const countNode = document.querySelector('#count');
  const statusNode = document.querySelector('#status');
  for (const button of document.querySelectorAll('.add')) {
    button.addEventListener('click', () => {
      count += 1;
      countNode.textContent = String(count);
      statusNode.textContent = `Cart contains ${count} item${count === 1 ? '' : 's'}.`;
    });
  }
})();
