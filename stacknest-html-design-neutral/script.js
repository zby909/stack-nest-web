const modal = document.getElementById('projectModal');
const openBtn = document.getElementById('openProjectModal');
const closeBtn = document.getElementById('closeProjectModal');
const cancelBtn = document.getElementById('cancelProjectModal');

function openModal() {
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

openBtn?.addEventListener('click', openModal);
closeBtn?.addEventListener('click', closeModal);
cancelBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
