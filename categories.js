"use strict";
function initModalCategoryHandler() {
    const modal = document.getElementById("editCategoryModel");
    const openBtn = document.getElementById("openEditCategoriesBtn");
    const closeBtn = document.getElementById("closeEditCategoryBtn");
    const cancelBtn = document.getElementById("cancelEditCaetegoryBtn");
    if (!modal || !openBtn || !closeBtn || !cancelBtn) {
        return;
    }
    const closeModal = () => {
        modal.classList.remove("active");
    };
    openBtn.addEventListener("click", () => {
        modal.classList.add("active");
    });
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}
initModalCategoryHandler();
