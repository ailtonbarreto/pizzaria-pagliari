const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSatTI0CuuXWGFOEdy57qLkL3id3tNhs8Cc4eaxHs3QnRw9FjGlg_2NOQ878HQsCE2fUSkQYXpC9tu-/pub?gid=0&single=true&output=csv";
const WHATSAPP_URL = "https://wa.me/5516992849489/?text=";

const menuContent = document.querySelector("#menu-content");
const categoryNav = document.querySelector("#category-nav");
const searchInput = document.querySelector("#menu-search");
const isCategoryPage = document.body.dataset.page === "category";
const selectedCategory = new URLSearchParams(window.location.search).get("categoria");
const categoryTitle = document.querySelector("#category-title");
const categoryDescription = document.querySelector("#category-description");
const categoryResults = document.querySelector("#category-results");
const popularPizzasContainer = document.querySelector("#popular-pizzas");
const featuredPizzasContainer = document.querySelector("#featured-pizzas");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector("#menu-toggle");
const cartDrawer = document.querySelector("#cart-drawer");
const cartBackdrop = document.querySelector("#cart-backdrop");
const cartItemsContainer = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const checkoutButton = document.querySelector("#checkout");
const toast = document.querySelector("#toast");

const products = [];
const cart = new Map();
let toastTimeout;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parsePrice(value) {
  if (typeof value === "number") return value;
  const cleaned = normalizeText(value).replace(/[^\d,.-]/g, "");
  const decimalValue = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(decimalValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalizeProduct(row, index) {
  const fields = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeText(key).replace(/^\uFEFF/, "").toLowerCase(), value])
  );
  const category = normalizeText(fields.categoria);
  const name = normalizeText(fields.nome);
  const price = parsePrice(fields.preco);
  if (!category || !name || price === null) return null;
  if (normalizeText(fields.status).toLowerCase() !== "ativo") return null;

  return {
    id: `${slugify(category)}-${slugify(name)}-${index}`,
    category,
    name,
    description: normalizeText(fields.descricao),
    price,
    image: normalizeText(fields.imagem)
  };
}

function renderCategoryLinks(categories) {
  const homeLink = `<a href="index.html"${!isCategoryPage ? ' aria-current="page"' : ""}>Início</a>`;
  const categoryLinks = categories.map((category) => {
    const current = isCategoryPage && category === selectedCategory;
    return `<a href="categoria.html?categoria=${encodeURIComponent(category)}"${current ? ' aria-current="page"' : ""}>${escapeHtml(category)}</a>`;
  }).join("");
  categoryNav.innerHTML = homeLink + categoryLinks;
}

function renderHomePizzas() {
  const pizzas = products.filter((product) => slugify(product.category) === "pizzas");
  if (!pizzas.length) {
    const emptyMessage = `<div class="empty-state">Nenhuma pizza disponível no momento.</div>`;
    popularPizzasContainer.innerHTML = emptyMessage;
    featuredPizzasContainer.innerHTML = emptyMessage;
    return;
  }

  const popularNames = [
    "frango-com-catupiry",
    "calabresa-c-palmito",
    "calabresa-c-catupiry",
    "quatro-queijos",
    "mineira",
    "canadense",
    "mucarela",
    "baiana"
  ];
  const popular = popularNames
    .map((name) => pizzas.find((product) => slugify(product.name) === name))
    .filter(Boolean);
  pizzas.forEach((product) => {
    if (popular.length < 8 && !popular.includes(product)) popular.push(product);
  });
  const featured = pizzas.filter((product) => !popular.includes(product)).slice(0, 8);

  popularPizzasContainer.innerHTML = popular.slice(0, 8).map(productCard).join("");
  featuredPizzasContainer.innerHTML = featured.length
    ? featured.map(productCard).join("")
    : `<div class="empty-state">Mais sabores em breve.</div>`;
}

function productCard(product) {
  const category = product.category.toLocaleLowerCase("pt-BR");
  const icon = category.includes("bebida") ? "local_drink"
    : category.includes("porç") ? "lunch_dining"
      : category.includes("petisco") ? "restaurant" : "local_pizza";
  const imageMarkup = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'product-placeholder', innerHTML: '<span class=material-symbols-rounded>${icon}</span>', ariaHidden: 'true' }))">`
    : `<div class="product-placeholder" aria-hidden="true"><span class="material-symbols-rounded">${icon}</span></div>`;
  return `
    <article class="product-card">
      <div class="product-image">${imageMarkup}</div>
      <div class="product-info">
        <h4>${escapeHtml(product.name)}</h4>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <div class="product-bottom">
          <span class="product-price">${money.format(product.price)}</span>
          <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Adicionar ${escapeHtml(product.name)} ao pedido"><span class="material-symbols-rounded" aria-hidden="true">add</span> Adicionar</button>
        </div>
      </div>
    </article>`;
}

function renderMenu() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = products.filter((product) =>
    product.category === selectedCategory &&
    (!query || `${product.name} ${product.description}`.toLocaleLowerCase("pt-BR").includes(query))
  );

  if (!visibleProducts.length) {
    menuContent.innerHTML = `<div class="empty-state">${query ? "Não encontramos itens com esse nome." : "Esta categoria não tem produtos ativos no momento."}</div>`;
    if (categoryResults) categoryResults.textContent = "";
    return;
  }

  menuContent.innerHTML = `<div class="product-grid">${visibleProducts.map(productCard).join("")}</div>`;
  if (categoryResults) {
    const count = products.filter((product) => product.category === selectedCategory).length;
    const visibleCount = query ? visibleProducts.length : count;
    categoryResults.textContent = `${visibleCount} ${visibleCount === 1 ? "opção" : "opções"}`;
  }
}

function restoreCart() {
  try {
    const savedCart = localStorage.getItem("pagliari-cart");
    if (!savedCart) return;
    const entries = JSON.parse(savedCart);
    if (!Array.isArray(entries)) throw new TypeError("Formato de sacola inválido.");
    entries.forEach((entry) => {
      if (!entry || typeof entry.id !== "string" || !entry.product ||
          !Number.isInteger(entry.quantity) || entry.quantity < 1 ||
          !Number.isFinite(entry.product.price)) return;
      cart.set(entry.id, {
        product: entry.product,
        quantity: entry.quantity,
        note: typeof entry.note === "string" ? entry.note : ""
      });
    });
  } catch (error) {
    console.error("Não foi possível restaurar a sacola salva:", error);
    showToast("Não foi possível recuperar a sacola anterior.");
  }
}

function persistCart() {
  try {
    localStorage.setItem("pagliari-cart", JSON.stringify([...cart.entries()].map(([id, item]) => ({
      id,
      product: item.product,
      quantity: item.quantity,
      note: item.note
    }))));
  } catch (error) {
    console.error("Não foi possível salvar a sacola:", error);
    showToast("Não foi possível salvar sua sacola neste navegador.");
  }
}

function renderCart() {
  const entries = [...cart.values()];
  const count = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  cartCount.textContent = String(count);
  cartTotal.textContent = money.format(total);
  checkoutButton.disabled = entries.length === 0;

  if (!entries.length) {
    cartItemsContainer.innerHTML = `<p class="cart-empty">Sua sacola está vazia.<br>Que tal escolher uma delícia do cardápio?</p>`;
    return;
  }

  cartItemsContainer.innerHTML = entries.map(({ product, quantity, note }) => `
    <div class="cart-item">
      <div class="cart-item-name">${escapeHtml(product.name)}</div>
      <div class="cart-item-price">${money.format(product.price * quantity)}</div>
      <div class="quantity-control" aria-label="Quantidade de ${escapeHtml(product.name)}">
        <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="-1" aria-label="Remover uma unidade"><span class="material-symbols-rounded" aria-hidden="true">remove</span></button>
        <span>${quantity}</span>
        <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="1" aria-label="Adicionar uma unidade"><span class="material-symbols-rounded" aria-hidden="true">add</span></button>
      </div>
      <button class="remove-item" type="button" data-remove="${escapeHtml(product.id)}">Remover</button>
      <label class="cart-item-note">
        <span>Observação deste item</span>
        <textarea data-note="${escapeHtml(product.id)}" maxlength="250" rows="2" placeholder="Ex.: sem cebola, bem passada...">${escapeHtml(note || "")}</textarea>
      </label>
    </div>`).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function setCartOpen(isOpen) {
  cartDrawer.classList.toggle("open", isOpen);
  cartDrawer.setAttribute("aria-hidden", String(!isOpen));
  cartBackdrop.hidden = !isOpen;
  document.body.classList.toggle("drawer-open", isOpen);
  if (isOpen) document.querySelector("#close-cart").focus();
  else document.querySelector("#open-cart").focus();
}

function setMenuOpen(isOpen) {
  siteHeader.classList.toggle("menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  menuToggle.querySelector(".material-symbols-rounded").textContent = isOpen ? "close" : "menu";
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const existing = cart.get(productId);
  cart.set(productId, {
    product,
    quantity: (existing?.quantity || 0) + 1,
    note: existing?.note || ""
  });
  persistCart();
  renderCart();
  showToast(`${product.name} adicionado à sacola.`);
}

function loadMenu() {
  if (!window.Papa) {
    showMenuError("Não foi possível carregar o cardápio.", "Atualize a página para tentar novamente.");
    return;
  }

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: "greedy",
    complete(results) {
      if (results.errors.length) {
        console.error("Erros ao ler o CSV do cardápio:", results.errors);
      }
      const loadedProducts = results.data.map(normalizeProduct).filter(Boolean);
      if (!loadedProducts.length) {
        showMenuError("O cardápio está indisponível.", "Confira as colunas categoria, nome, preco e status na planilha.");
        return;
      }
      products.push(...loadedProducts);
      cart.forEach((item, id) => {
        const currentProduct = products.find((product) => product.id === id);
        if (currentProduct) item.product = currentProduct;
      });
      persistCart();
      renderCart();
      const categories = [...new Set(products.map((product) => product.category))];
      renderCategoryLinks(categories);
      if (isCategoryPage) {
        if (!categories.includes(selectedCategory)) {
          categoryTitle.textContent = "Categoria não encontrada";
          categoryDescription.textContent = "Volte ao início e escolha uma categoria disponível.";
          menuContent.innerHTML = `<div class="empty-state"><a class="back-link" href="index.html#mais-pedidas">← Voltar à página inicial</a></div>`;
          return;
        }
        categoryTitle.textContent = selectedCategory;
        categoryDescription.textContent = "Escolha suas delícias favoritas.";
        document.title = `${selectedCategory} | Pizzaria Pagliari`;
        renderMenu();
      } else {
        renderHomePizzas();
      }
    },
    error(error) {
      console.error("Não foi possível carregar o CSV do cardápio:", error);
      showMenuError("Não foi possível carregar o cardápio.", "Verifique sua conexão e tente novamente.");
    }
  });
}

function showMenuError(title, message) {
  const error = `<div class="error-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>`;
  if (menuContent) {
    menuContent.innerHTML = error;
    return;
  }
  if (popularPizzasContainer) popularPizzasContainer.innerHTML = error;
  if (featuredPizzasContainer) featuredPizzasContainer.innerHTML = error;
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) {
    addToCart(addButton.dataset.add);
    return;
  }

  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    const { quantity } = cart.get(quantityButton.dataset.quantity);
    const nextQuantity = quantity + Number(quantityButton.dataset.change);
    if (nextQuantity <= 0) cart.delete(quantityButton.dataset.quantity);
    else cart.get(quantityButton.dataset.quantity).quantity = nextQuantity;
    persistCart();
    renderCart();
    return;
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    cart.delete(removeButton.dataset.remove);
    persistCart();
    renderCart();
  }
});

cartItemsContainer.addEventListener("input", (event) => {
  const noteField = event.target.closest("[data-note]");
  if (!noteField) return;
  const item = cart.get(noteField.dataset.note);
  if (!item) return;
  item.note = noteField.value;
  persistCart();
});

if (searchInput) searchInput.addEventListener("input", renderMenu);
menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") !== "true";
  if (isOpen && cartDrawer.classList.contains("open")) setCartOpen(false);
  setMenuOpen(isOpen);
});
categoryNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});
document.querySelector("#open-cart").addEventListener("click", () => {
  setMenuOpen(false);
  setCartOpen(true);
});
document.querySelector("#close-cart").addEventListener("click", () => setCartOpen(false));
cartBackdrop.addEventListener("click", () => setCartOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartDrawer.classList.contains("open")) setCartOpen(false);
  if (event.key === "Escape" && siteHeader.classList.contains("menu-open")) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});
checkoutButton.addEventListener("click", () => {
  const entries = [...cart.values()];
  if (!entries.length) return;
  const lines = entries.flatMap(({ product, quantity, note }) => [
    `${quantity}x ${product.name} - ${money.format(product.price * quantity)}`,
    ...(note && note.trim() ? [`   Observação: ${note.trim()}`] : [])
  ]);
  const total = entries.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const message = ["Olá! Gostaria de fazer este pedido:", "", ...lines, "", `Total: ${money.format(total)}`].join("\n");
  window.open(`${WHATSAPP_URL}${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());
restoreCart();
renderCart();
loadMenu();
