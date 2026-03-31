const EXPENSES_DB_KEY = "spendwise_expenses_db_v1";
const EXPENSES_DB_VERSION_KEY = "spendwise_expenses_db_version";
const EXPENSES_DB_VERSION = "6";


let debuglog : boolean = true 
type categoryBudget = {
  category : string, 
  budget : number 
}


function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTableAmount(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function isInCurrentMonth(isoDate: string): boolean {
  const date = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function readLocalDb(): any | null {
  try {
    const raw = localStorage.getItem(EXPENSES_DB_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.transactions)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function writeLocalDb(db: any): void {
  localStorage.setItem(EXPENSES_DB_KEY, JSON.stringify(db));
  localStorage.setItem(EXPENSES_DB_VERSION_KEY, EXPENSES_DB_VERSION);
}

function normalizeCategory(rawCategory: any, categoryBudget2 : categoryBudget[]): string {
  const category = String(rawCategory || "").trim().toLowerCase();
  if (category === "housing") {
    return "rent";
  }
  return categoryBudget2.map((item:any) => item.category).includes(category) ? category : "other";
}


function normalizeDbShape(db: any): {
  monthlyIncome: number; 
  categoryBudget2: any;
  startingBalance: number;
  transactions: any[];
} {
  const normalizedTransactions = Array.isArray(db.transactions)
    ? db.transactions.map((item: any) => ({
        ...item,
        category: normalizeCategory(item.category, db.categoryBudget2),
        createdAt: item.createdAt || `${item.date}T00:00:00`,
      }))
    : [];

  return {
    monthlyIncome: Number(db.monthlyIncome || 0),
    categoryBudget2: db.categoryBudget2,
    startingBalance: Number(db.startingBalance || 0),
    transactions: normalizedTransactions,
  };
}

async function loadSeedDb(): Promise<any> {
  const response = await fetch("./expenses.json", { cache: "no-store" });
  const data = await response.json();
  if (debuglog === true){console.log("initial exprenses.json read:", data)} 
  return normalizeDbShape(data);
}

function categoryLabel(category: string): string {
    // capitalize first letter 
  return category
    .toLowerCase() // Optional: Ensure other letters are lowercase
    .split(' ')    // Split into an array of words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each
    .join(' ');    // Join back into a single string
}

function transactionSortValue(item: any): string {
  const datePart = item.date || "";
  const createdPart = item.createdAt || `${datePart}T00:00:00`;
  return `${datePart}|${createdPart}`;
}

function getEffectiveExpenseAmount(item: any): number {
  const rawAmount = Number(item.amount || 0);
  const splitInfo = item.splitBetween;

  if (
    rawAmount < 0 &&
    splitInfo &&
    typeof splitInfo === "object" &&
    Number.isFinite(Number(splitInfo.eachAmount)) &&
    Number(splitInfo.eachAmount) > 0
  ) {
    return -Math.abs(Number(splitInfo.eachAmount));
  }

  return rawAmount;
}

function renderBudgetProgress(db: any): number {
  const progressListEl = document.getElementById("budgetProgressList");
  if (!progressListEl) {
    return 0;
  }

  const monthlyTransactions = db.transactions.filter((item: any) => isInCurrentMonth(item.date));
  let catBugList = db.categoryBudget2 

  const html = catBugList.map((i:categoryBudget) => {
    const budget = Number(i.budget || 0);
    const used = monthlyTransactions
      .filter((item: any) => getEffectiveExpenseAmount(item) < 0 && item.category === i.category)
      .reduce((sum: number, item: any) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);

    const usedPercent = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
    return `
      <div class="budget-item">
        <p>${categoryLabel(i.category)} Used: <strong>${formatCurrency(used)} (${Math.round(usedPercent)}%)</strong> • Budget: <strong>${formatCurrency(budget)}</strong></p>
        <div class="bar" style="--progress: ${Math.round(usedPercent)}%;">
          <div class="bar-fill"></div>
        </div>
      </div>
    `;
  }).join("");

  progressListEl.innerHTML = html;
  const bugList:number[] = catBugList.map((item:categoryBudget) => item.budget);
  const totalBudget = (bugList.reduce((accumulator, currentValue) => accumulator + currentValue, 0) || 0);
  
  const totalUsed = monthlyTransactions
    .filter((item: any) => getEffectiveExpenseAmount(item) < 0)
    .reduce((sum: number, item: any) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);

  return Math.max(0, totalBudget - totalUsed);
}

function renderDashboard(db: any): void {
  const tableBody = document.getElementById("transactionTableBody");
  const totalBalanceEl = document.getElementById("totalBalanceValue");
  const monthlyIncomeEl = document.getElementById("monthlyIncomeValue");
  const monthlySpendEl = document.getElementById("monthlySpendValue");
  const budgetRemainingEl = document.getElementById("budgetRemainingValue");

  if (
    !tableBody ||
    !totalBalanceEl ||
    !monthlyIncomeEl ||
    !monthlySpendEl ||
    !budgetRemainingEl
  ) {
    return;
  }

  const monthlyTransactions = db.transactions.filter((item: any) => isInCurrentMonth(item.date));
  const transactions = [...monthlyTransactions].sort((a: any, b: any) => {
    const aKey = transactionSortValue(a);
    const bKey = transactionSortValue(b);
    if (aKey === bKey) {
      return 0;
    }
    return aKey < bKey ? 1 : -1;
  });

  tableBody.innerHTML =
    transactions.length > 0
      ? transactions
          .map(
            (item: any) => `
        <tr>
          <td>${formatShortDate(item.date)}</td>
          <td>${item.description}</td>
          <td>${categoryLabel(item.category)}</td>
          <td>${formatTableAmount(getEffectiveExpenseAmount(item))}</td>
        </tr>
      `
          )
          .join("")
      : `
      <tr>
        <td colspan="4">No transactions for this month.</td>
      </tr>
    `;

  const monthlyIncome = Number(db.monthlyIncome || 0);

  const monthlySpend = monthlyTransactions
    .filter((item: any) => getEffectiveExpenseAmount(item) < 0)
    .reduce((sum: number, item: any) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);

  const budgetRemaining = renderBudgetProgress(db);
  const totalBalance = monthlyIncome - monthlySpend;

  totalBalanceEl.textContent = formatCurrency(totalBalance);
  monthlyIncomeEl.textContent = formatCurrency(monthlyIncome);
  monthlySpendEl.textContent = formatCurrency(monthlySpend);
  budgetRemainingEl.textContent = formatCurrency(budgetRemaining);
}

function setAddExpenseMessage(text: string, type: string): void {
  const messageEl = document.getElementById("addExpenseMessage");
  if (!messageEl) {
    return;
  }
  messageEl.textContent = text;
  messageEl.className = `auth-message ${type}`;
}

function expenseTypeToDescription(type: any): string {
  const labels: Record<string, string> = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    food: "Food",
    transport: "Transport",
    entertainment: "Entertainment",
    other: "Other",
  };
  return labels[type] || "Expense";
}

function initModalHandlers(dbRef: any): void {
  const modal = document.getElementById("addExpenseModal");
  const openBtn = document.getElementById("openAddExpenseBtn");
  const closeBtn = document.getElementById("closeAddExpenseBtn");
  const cancelBtn = document.getElementById("cancelAddExpenseBtn");
  const form = document.getElementById("addExpenseForm") as any;
  const splitToggle = document.getElementById("isSplitExpense") as any;
  const splitSection = document.getElementById("splitSection");
  const totalWithTipEl = document.getElementById("totalWithTipValue");
  const splitPreviewEl = document.getElementById("splitPreview");
  const splitCountInput = document.getElementById("splitCount") as any;
  const expenseCategoryList = document.getElementById("expenseCategoryList");
  const expenseTypeSelect = document.getElementById("expenseType") as HTMLSelectElement;

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
    !splitCountInput || 
    !expenseTypeSelect
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

  function renderExpenseCategoryOptions(dbRef: any): void {
  const categories = dbRef.current.categoryBudget2 || [];
  expenseTypeSelect.innerHTML = `
    <option value="">Select type...</option>
    ${categories
      .map((item: categoryBudget) =>
        `<option value="${item.category}">${categoryLabel(item.category)}</option>`
      )
      .join("")}
  `;
  }
  renderExpenseCategoryOptions(dbRef);

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
      category: normalizeCategory(expenseType, dbRef.current.categoryBudget2),
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

function initModalCategoryHandler(dbRef:any): void {
  const modal = document.getElementById("editCategoryModel");
  const openBtn = document.getElementById("openEditCategoriesBtn");
  const closeBtn = document.getElementById("closeEditCategoryBtn");
  const cancelBtn = document.getElementById("cancelEditCaetegoryBtn");
  const nameInput = document.getElementById("categoryNameInput");
  const budgetInput = document.getElementById("categoryBudgetInput");

  if (!modal || !openBtn || !closeBtn || !cancelBtn || !nameInput || !budgetInput) {
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


(async function initDashboard(): Promise<void> {
  const localDbVersion = localStorage.getItem(EXPENSES_DB_VERSION_KEY);
  const localDb = localDbVersion === EXPENSES_DB_VERSION ? readLocalDb() : null;
  const dbRef = { current: localDb ? normalizeDbShape(localDb) : null };
  
  if (!dbRef.current) {
    try {
      dbRef.current = await loadSeedDb();
      writeLocalDb(dbRef.current);
    } catch (error) {
      dbRef.current = normalizeDbShape({
        monthlyIncome: 0, 
        startingBalance: 0,
        transactions: [],
      });
    }
  }

  renderDashboard(dbRef.current);
  initModalHandlers(dbRef);
  initModalCategoryHandler(dbRef);
})();