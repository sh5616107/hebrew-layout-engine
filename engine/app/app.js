const form = document.querySelector('#layout-form');
const status = document.querySelector('#status');
const preview = document.querySelector('#pdf');
const download = document.querySelector('#download');
const button = form.querySelector('button');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = 'מעבד את הטקסט…';
  const values = Object.fromEntries(new FormData(form));
  for (const key of ['fontSize', 'pageWidth', 'pageHeight', 'margin', 'columnGap', 'lineHeight']) {
    values[key] = Number(values[key]);
  }
  try {
    const response = await fetch('/api/render', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'העימוד נכשל.');
    const url = `/preview.pdf?${Date.now()}`;
    preview.src = url;
    download.href = url;
    download.hidden = false;
    status.textContent = `נוצר PDF בן ${result.pages} עמודים.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'העימוד נכשל.';
  } finally {
    button.disabled = false;
  }
});
