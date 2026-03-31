function initModalCategoryHandler(): void {
  const modal = document.getElementById("editCategoryModel");
  const openBtn = document.getElementById("openEditCategoriesBtn");
  const closeBtn = document.getElementById("closeEditCategoryBtn");
  const cancelBtn = document.getElementById("cancelEditCaetegoryBtn");

  if (!modal || !openBtn || !closeBtn || !cancelBtn) {
    return;
  }

  const closeModal = (): void => {
    modal.classList.remove("active");
  };

  openBtn.addEventListener("click", (): void => {
    modal.classList.add("active");
  });

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event: MouseEvent): void => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

initModalCategoryHandler();