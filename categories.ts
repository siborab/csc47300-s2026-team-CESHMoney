



function initModalCategoryHandler(dbRef: any): void {
  const modal = document.getElementById("editCategoryModel");
  const openBtn = document.getElementById("openEditCategoriesBtn");
  const closeBtn = document.getElementById("closeEditCategoryBtn");
  const cancelBtn = document.getElementById("cancelEditCaetegoryBtn");
  const form = document.getElementById("editCategoriesForm") as any;
  const splitToggle = document.getElementById("isSplitExpense") as any;
  const splitSection = document.getElementById("splitSection");
  const totalWithTipEl = document.getElementById("totalWithTipValue");
  const splitPreviewEl = document.getElementById("splitPreview");
  const splitCountInput = document.getElementById("splitCount") as any;

  if (
    !modal ||
    !openBtn ||
    !closeBtn ||
    !cancelBtn ||
    !form ||
    !splitToggle ||
    !splitSection ||
    !totalWithTipEl ||
    !splitPreviewEl ||
    !splitCountInput
  ) {
    return;
  }

  const getTotalWithTip = (): number => {
    const baseAmount = Number(form.baseAmount.value);
    const tipPercent = Number(form.tipPercent.value || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return 0;
    }
    return baseAmount + (baseAmount * Math.max(0, tipPercent) / 100);
  };

  const refreshTotalWithTip = (): void => {
    totalWithTipEl.textContent = formatCurrency(getTotalWithTip());
  };

  const buildEqualSplit = (count: number, totalAmount: number): number => {
    const totalCents = Math.round(totalAmount * 100);
    const perPersonCents = Math.round(totalCents / count);
    return perPersonCents / 100;
  };

  const refreshSplitPreview = (): void => {
    if (!splitToggle.checked) {
      splitPreviewEl.textContent = "";
      return;
    }
    const splitCount = Number.parseInt(splitCountInput.value, 10);
    const totalAmount = getTotalWithTip();
    if (!Number.isFinite(splitCount) || splitCount < 2 || totalAmount <= 0) {
      splitPreviewEl.textContent = "Enter how many people to split with.";
      return;
    }
    const eachAmount = buildEqualSplit(splitCount, totalAmount);
    splitPreviewEl.textContent = `Auto split -> ${splitCount} people, each pays ${formatCurrency(eachAmount)}`;
  };

  const setSplitSectionState = (): void => {
    splitSection.classList.toggle("hidden", !splitToggle.checked);
    if (!splitToggle.checked) {
      splitCountInput.value = "2";
    }
    refreshSplitPreview();
  };

  const resetModalForm = (): void => {
    form.reset();
    setAddExpenseMessage("", "");
    refreshTotalWithTip();
    setSplitSectionState();
  };

  const closeModal = (): void => {
    modal.classList.remove("active");
    resetModalForm();
  };

  openBtn.addEventListener("click", (): void => {
    modal.classList.add("active");
    refreshTotalWithTip();
    setSplitSectionState();
  });

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event: MouseEvent): void => {
    if (event.target === modal) {
      closeModal();
    }
  });

  form.baseAmount.addEventListener("input", refreshTotalWithTip);
  form.baseAmount.addEventListener("input", refreshSplitPreview);
  form.tipPercent.addEventListener("input", refreshTotalWithTip);
  form.tipPercent.addEventListener("input", refreshSplitPreview);
  splitCountInput.addEventListener("input", refreshSplitPreview);
  splitToggle.addEventListener("change", setSplitSectionState);

  form.addEventListener("submit", (event: Event): void => {
    event.preventDefault();

    const expenseType = form.expenseType.value;
    const baseAmount = Number(form.baseAmount.value);
    const tipPercent = Number(form.tipPercent.value || 0);
    const note = form.expenseNote.value.trim();
    const totalAmount = getTotalWithTip();

    if (!expenseType || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      setAddExpenseMessage("Please fill all fields with a valid amount.", "error");
      return;
    }

    if (!Number.isFinite(tipPercent) || tipPercent < 0) {
      setAddExpenseMessage("Tip must be zero or a positive value.", "error");
      return;
    }

    let splitDetails: any = [];
    let effectiveAmount = totalAmount;

    if (splitToggle.checked) {
      const splitCount = Number.parseInt(splitCountInput.value, 10);
      if (!Number.isFinite(splitCount) || splitCount < 2) {
        setAddExpenseMessage("Split count must be at least 2.", "error");
        return;
      }
      splitDetails = {
        splitCount,
        eachAmount: buildEqualSplit(splitCount, totalAmount),
      };
      effectiveAmount = splitDetails.eachAmount;
    }

    const splitTag = splitToggle.checked
      ? ` (Split bill: ${splitDetails.splitCount} people)`
      : "";

    const description = note
      ? `${expenseTypeToDescription(expenseType)}${splitTag} - ${note}`
      : `${expenseTypeToDescription(expenseType)}${splitTag}`;

    dbRef.current.transactions.unshift({
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      description,
      category: normalizeCategory(expenseType),
      amount: -Math.abs(effectiveAmount),
      totalAmount: -Math.abs(totalAmount),
      type: "expense",
      baseAmount,
      tipPercent,
      paidBy: "self",
      splitBetween: splitDetails,
    });

    writeLocalDb(dbRef.current);
    renderDashboard(dbRef.current);

    setAddExpenseMessage("Expense added successfully.", "success");
    setTimeout(closeModal, 500);
  });
}










