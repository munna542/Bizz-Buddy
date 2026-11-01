// app.js - Complete with authentication and role-based CRUD
let db = {
    users: [],
    products: [],
    categories: [],
    customers: [],
    sales: [],
    saleItems: [],
    inventory: [],
    expenses: []
};

let currentUser = null;
let currentModule = 'dashboard';
let editingItem = null;
let crudType = null; // 'product', 'inventory', 'expense', 'customer', 'user'

// Initialize application
async function initApp() {
    await loadDatabase();
    checkAuthState();
}

// Load database from JSON file
async function loadDatabase() {
    try {
        const response = await fetch('db.json');
        if (!response.ok) throw new Error('Failed to load database');
        const jsonData = await response.json();
        db = { ...db, ...jsonData };
        
        // Ensure admin user exists
        if (!db.users.find(u => u.email === 'admin@bizz.com')) {
            db.users.push({
                id: 999,
                name: "System Admin",
                email: "admin@bizz.com",
                password: "admin123",
                role: "Admin",
                phone: "555-0000"
            });
        }
    } catch (e) {
        console.warn('Using embedded data');
        db = getEmbeddedExamples();
    }
    saveDatabase();
}

// Save database to localStorage
function saveDatabase() {
    localStorage.setItem('bizzBuddyDB', JSON.stringify(db));
}

// Load from localStorage if available
function loadFromStorage() {
    const stored = localStorage.getItem('bizzBuddyDB');
    if (stored) {
        db = JSON.parse(stored);
    }
}

// Authentication functions
function checkAuthState() {
    const savedUser = localStorage.getItem('bizzBuddyUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        showAuthModal('login');
    }
}

function showAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('modalTitle');
    const signupFields = document.getElementById('signupFields');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('switchText');
    
    if (mode === 'login') {
        title.textContent = 'Login to Bizz Buddy';
        signupFields.style.display = 'none';
        submitBtn.textContent = 'Login';
        switchText.textContent = "Don't have an account?";
    } else {
        title.textContent = 'Create Account';
        signupFields.style.display = 'block';
        submitBtn.textContent = 'Sign Up';
        switchText.textContent = "Already have an account?";
    }
    
    modal.classList.add('show');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('show');
}

function toggleAuthMode(event) {
    event.preventDefault();
    const title = document.getElementById('modalTitle');
    if (title.textContent.includes('Login')) {
        showAuthModal('signup');
    } else {
        showAuthModal('login');
    }
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const isSignup = document.getElementById('modalTitle').textContent.includes('Create');
    
    if (isSignup) {
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const role = document.getElementById('role').value;
        
        if (!name) {
            alert('Please enter your name');
            return;
        }
        
        // Check if user exists
        if (db.users.find(u => u.email === email)) {
            alert('User with this email already exists');
            return;
        }
        
        // Create new user
        const newUser = {
            id: Math.max(...db.users.map(u => u.id), 0) + 1,
            name,
            email,
            password,
            role,
            phone: phone || ''
        };
        
        db.users.push(newUser);
        saveDatabase();
        currentUser = newUser;
        localStorage.setItem('bizzBuddyUser', JSON.stringify(currentUser));
        closeAuthModal();
        showMainApp();
    } else {
        // Login
        const user = db.users.find(u => u.email === email && u.password === password);
        if (user) {
            currentUser = user;
            localStorage.setItem('bizzBuddyUser', JSON.stringify(currentUser));
            closeAuthModal();
            showMainApp();
        } else {
            alert('Invalid email or password');
        }
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('bizzBuddyUser');
    document.getElementById('mainApp').style.display = 'none';
    showAuthModal('login');
}

function showMainApp() {
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserRole').textContent = currentUser.role;
    
    generateNavigationTabs();
    switchModule('dashboard');
}

// Generate navigation based on role
function generateNavigationTabs() {
    const tabsContainer = document.getElementById('moduleTabs');
    const tabs = [];
    
    // Everyone can see dashboard
    tabs.push({ id: 'dashboard', label: '📊 Dashboard', icon: '📊' });
    
    // Products & Inventory - everyone can view, but edit permissions vary
    tabs.push({ id: 'products', label: '📦 Products', icon: '📦' });
    
    // Sales - everyone can view
    tabs.push({ id: 'sales', label: '🧾 Sales', icon: '🧾' });
    
    if (currentUser.role === 'Admin' || currentUser.role === 'Manager') {
        tabs.push({ id: 'expenses', label: '💰 Expenses', icon: '💰' });
    }
    
    if (currentUser.role === 'Admin') {
        tabs.push({ id: 'users', label: '👥 Users', icon: '👥' });
        tabs.push({ id: 'reports', label: '📈 Reports', icon: '📈' });
    }
    
    if (currentUser.role === 'Manager') {
        tabs.push({ id: 'reports', label: '📈 Reports', icon: '📈' });
    }
    
    tabsContainer.innerHTML = tabs.map(tab => 
        `<button class="tab-btn" data-module="${tab.id}">${tab.icon} ${tab.label}</button>`
    ).join('');
    
    // Add click handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchModule(btn.dataset.module));
    });
}

// Module switching
function switchModule(moduleId) {
    currentModule = moduleId;
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.module === moduleId);
    });
    
    // Render module
    const renderFunctions = {
        dashboard: renderDashboard,
        products: renderProducts,
        sales: renderSales,
        expenses: renderExpenses,
        users: renderUsers,
        reports: renderReports
    };
    
    if (renderFunctions[moduleId]) {
        renderFunctions[moduleId]();
    }
    
    setNotification(`${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} module loaded`);
}

// CRUD Modal functions
function openCrudModal(type, item = null) {
    crudType = type;
    editingItem = item;
    const modal = document.getElementById('crudModal');
    const title = document.getElementById('crudModalTitle');
    const fieldsDiv = document.getElementById('crudFields');
    
    title.textContent = item ? `Edit ${type}` : `Add ${type}`;
    
    // Generate form fields based on type
    let fieldsHtml = '';
    
    switch(type) {
        case 'product':
            fieldsHtml = `
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="prodName" value="${item?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" id="prodPrice" value="${item?.price || ''}" required>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="prodCategory" required>
                        ${db.categories.map(c => `<option value="${c.id}" ${item?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
            `;
            break;
        case 'inventory':
            const product = item ? db.products.find(p => p.id === item.product_id) : null;
            fieldsHtml = `
                <div class="form-group">
                    <label>Product</label>
                    <select id="invProduct" ${item ? 'disabled' : 'required'}>
                        ${db.products.map(p => {
                            const hasInventory = db.inventory.some(i => i.product_id === p.id);
                            return `<option value="${p.id}" ${(item?.product_id === p.id || !hasInventory) ? 'selected' : ''}>${p.name}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="invQuantity" value="${item?.quantity || 0}" required>
                </div>
                <div class="form-group">
                    <label>Reorder Level</label>
                    <input type="number" id="invReorder" value="${item?.reorder_level || 10}" required>
                </div>
            `;
            break;
        case 'expense':
            fieldsHtml = `
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="expDesc" value="${item?.description || ''}" required>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" step="0.01" id="expAmount" value="${item?.amount || ''}" required>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <input type="text" id="expCategory" value="${item?.category || 'General'}" required>
                </div>
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" id="expDate" value="${item?.date || new Date().toISOString().split('T')[0]}" required>
                </div>
            `;
            break;
        case 'user':
            if (currentUser.role !== 'Admin') return;
            fieldsHtml = `
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="userName" value="${item?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="userEmail" value="${item?.email || ''}" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="userPassword" ${item ? 'placeholder="Leave blank to keep current"' : 'required'}>
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="userRole" required>
                        <option value="Staff" ${item?.role === 'Staff' ? 'selected' : ''}>Staff</option>
                        <option value="Manager" ${item?.role === 'Manager' ? 'selected' : ''}>Manager</option>
                        <option value="Admin" ${item?.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="userPhone" value="${item?.phone || ''}">
                </div>
            `;
            break;
        case 'customer':
            fieldsHtml = `
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="custName" value="${item?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="custEmail" value="${item?.email || ''}" required>
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="custPhone" value="${item?.phone || ''}">
                </div>
            `;
            break;
    }
    
    fieldsDiv.innerHTML = fieldsHtml;
    modal.classList.add('show');
}

function closeCrudModal() {
    document.getElementById('crudModal').classList.remove('show');
    crudType = null;
    editingItem = null;
}

function handleCrudSubmit(event) {
    event.preventDefault();
    
    switch(crudType) {
        case 'product':
            saveProduct();
            break;
        case 'inventory':
            saveInventory();
            break;
        case 'expense':
            saveExpense();
            break;
        case 'user':
            saveUser();
            break;
        case 'customer':
            saveCustomer();
            break;
    }
    
    closeCrudModal();
    switchModule(currentModule);
}

function saveProduct() {
    const name = document.getElementById('prodName').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const categoryId = parseInt(document.getElementById('prodCategory').value);
    
    if (editingItem) {
        Object.assign(editingItem, { name, price, category_id: categoryId });
    } else {
        const newId = Math.max(...db.products.map(p => p.id), 0) + 1;
        db.products.push({ id: newId, name, price, category_id: categoryId });
    }
    saveDatabase();
}

function saveInventory() {
    const productId = parseInt(document.getElementById('invProduct').value);
    const quantity = parseInt(document.getElementById('invQuantity').value);
    const reorderLevel = parseInt(document.getElementById('invReorder').value);
    
    if (editingItem) {
        Object.assign(editingItem, { quantity, reorder_level: reorderLevel, last_updated: new Date().toISOString().split('T')[0] });
    } else {
        db.inventory.push({
            product_id: productId,
            quantity,
            reorder_level: reorderLevel,
            last_updated: new Date().toISOString().split('T')[0]
        });
    }
    saveDatabase();
}

function saveExpense() {
    const description = document.getElementById('expDesc').value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    const category = document.getElementById('expCategory').value;
    const date = document.getElementById('expDate').value;
    
    if (editingItem) {
        Object.assign(editingItem, { description, amount, category, date });
    } else {
        const newId = Math.max(...db.expenses.map(e => e.id), 0) + 1;
        db.expenses.push({ id: newId, description, amount, category, date });
    }
    saveDatabase();
}

function saveUser() {
    if (currentUser.role !== 'Admin') return;
    
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const phone = document.getElementById('userPhone').value;
    
    if (editingItem) {
        Object.assign(editingItem, { name, email, role, phone });
        if (password) editingItem.password = password;
    } else {
        const newId = Math.max(...db.users.map(u => u.id), 0) + 1;
        db.users.push({ id: newId, name, email, password, role, phone });
    }
    saveDatabase();
}

function saveCustomer() {
    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;
    const phone = document.getElementById('custPhone').value;
    
    if (editingItem) {
        Object.assign(editingItem, { name, email, phone });
    } else {
        const newId = Math.max(...db.customers.map(c => c.id), 0) + 1;
        db.customers.push({ id: newId, name, email, phone });
    }
    saveDatabase();
}

function deleteItem(type, id) {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    switch(type) {
        case 'product':
            db.products = db.products.filter(p => p.id !== id);
            db.inventory = db.inventory.filter(i => i.product_id !== id);
            break;
        case 'inventory':
            db.inventory = db.inventory.filter(i => i.product_id !== id);
            break;
        case 'expense':
            db.expenses = db.expenses.filter(e => e.id !== id);
            break;
        case 'user':
            if (currentUser.role !== 'Admin') return;
            db.users = db.users.filter(u => u.id !== id);
            break;
        case 'customer':
            db.customers = db.customers.filter(c => c.id !== id);
            break;
    }
    saveDatabase();
    switchModule(currentModule);
}

// Render functions with permission-based buttons
function renderDashboard() {
    const totalSales = db.sales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
    const totalExpenses = db.expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const lowStock = db.inventory.filter(inv => inv.quantity < inv.reorder_level).length;
    
    const html = `
        <div class="kpi-grid">
            <div class="kpi-card"><span class="kpi-label">💰 Total Sales</span><div class="kpi-value">$${totalSales.toFixed(2)}</div></div>
            ${currentUser.role !== 'Staff' ? `<div class="kpi-card"><span class="kpi-label">📉 Total Expenses</span><div class="kpi-value">$${totalExpenses.toFixed(2)}</div></div>` : ''}
            <div class="kpi-card"><span class="kpi-label">📦 Low Stock Items</span><div class="kpi-value">${lowStock}</div></div>
            <div class="kpi-card"><span class="kpi-label">👥 Total Customers</span><div class="kpi-value">${db.customers.length}</div></div>
        </div>
        <div class="card-panel">
            <div class="section-title">📋 Recent Activity</div>
            <p>Welcome back, ${currentUser.name}! You have ${currentUser.role} access.</p>
            ${currentUser.role === 'Admin' ? '<p>🔐 Full system access · You can manage users and all business data.</p>' : ''}
            ${currentUser.role === 'Manager' ? '<p>📊 Manager access · You can manage inventory and view reports.</p>' : ''}
            ${currentUser.role === 'Staff' ? '<p>💼 Staff access · View products and process sales.</p>' : ''}
        </div>
    `;
    document.getElementById('module-content').innerHTML = html;
}

function renderProducts() {
    const canEdit = currentUser.role === 'Admin' || currentUser.role === 'Manager';
    const invMap = new Map(db.inventory.map(i => [i.product_id, i]));
    
    const html = `
        <div class="card-panel">
            <div class="section-header">
                <div class="section-title">📦 Products & Inventory</div>
                ${canEdit ? '<button class="add-btn" onclick="openCrudModal(\'product\')">➕ Add Product</button>' : ''}
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Status</th>
                            ${canEdit ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${db.products.map(p => {
                            const inv = invMap.get(p.id);
                            const stock = inv?.quantity || 0;
                            const status = stock === 0 ? 'Out of Stock' : stock < (inv?.reorder_level || 10) ? 'Low Stock' : 'In Stock';
                            return `
                                <tr>
                                    <td>${p.name}</td>
                                    <td>${db.categories.find(c => c.id === p.category_id)?.name || '—'}</td>
                                    <td>$${p.price.toFixed(2)}</td>
                                    <td>${stock}</td>
                                    <td><span class="badge">${status}</span></td>
                                    ${canEdit ? `
                                        <td class="actions-cell">
                                            <button class="btn-edit" onclick="openCrudModal('product', ${JSON.stringify(p).replace(/"/g, '&quot;')})">Edit</button>
                                            <button class="btn-edit" onclick="openCrudModal('inventory', ${JSON.stringify(inv || {product_id: p.id, quantity: 0, reorder_level: 10}).replace(/"/g, '&quot;')})">Stock</button>
                                            <button class="btn-danger" onclick="deleteItem('product', ${p.id})">Delete</button>
                                        </td>
                                    ` : ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('module-content').innerHTML = html;
}

function renderSales() {
    const html = `
        <div class="card-panel">
            <div class="section-header">
                <div class="section-title">🧑‍🤝‍🧑 Customers</div>
                ${currentUser.role !== 'Staff' ? '<button class="add-btn" onclick="openCrudModal(\'customer\')">➕ Add Customer</button>' : ''}
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Phone</th>${currentUser.role !== 'Staff' ? '<th>Actions</th>' : ''}</tr>
                    </thead>
                    <tbody>
                        ${db.customers.map(c => `
                            <tr>
                                <td>${c.name}</td>
                                <td>${c.email}</td>
                                <td>${c.phone || '—'}</td>
                                ${currentUser.role !== 'Staff' ? `
                                    <td class="actions-cell">
                                        <button class="btn-edit" onclick="openCrudModal('customer', ${JSON.stringify(c).replace(/"/g, '&quot;')})">Edit</button>
                                        <button class="btn-danger" onclick="deleteItem('customer', ${c.id})">Delete</button>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card-panel">
            <div class="section-title">🧾 Recent Sales</div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr><th>Date</th><th>Customer</th><th>Processed By</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                        ${db.sales.slice(0, 10).map(s => `
                            <tr>
                                <td>${s.date}</td>
                                <td>${db.customers.find(c => c.id === s.customer_id)?.name || '—'}</td>
                                <td>${db.users.find(u => u.id === s.user_id)?.name || '—'}</td>
                                <td>$${s.total_amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('module-content').innerHTML = html;
}

function renderExpenses() {
    if (currentUser.role === 'Staff') {
        document.getElementById('module-content').innerHTML = '<p>Access denied. Staff cannot view expenses.</p>';
        return;
    }
    
    const html = `
        <div class="card-panel">
            <div class="section-header">
                <div class="section-title">💰 Expense Management</div>
                <button class="add-btn" onclick="openCrudModal('expense')">➕ Add Expense</button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${db.expenses.map(e => `
                            <tr>
                                <td>${e.date}</td>
                                <td>${e.description}</td>
                                <td>${e.category || 'General'}</td>
                                <td>$${e.amount.toFixed(2)}</td>
                                <td class="actions-cell">
                                    <button class="btn-edit" onclick="openCrudModal('expense', ${JSON.stringify(e).replace(/"/g, '&quot;')})">Edit</button>
                                    <button class="btn-danger" onclick="deleteItem('expense', ${e.id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p style="margin-top:16px;"><strong>Total Expenses:</strong> $${db.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</p>
        </div>
    `;
    document.getElementById('module-content').innerHTML = html;
}

function renderUsers() {
    if (currentUser.role !== 'Admin') {
        document.getElementById('module-content').innerHTML = '<p>Access denied. Admin only.</p>';
        return;
    }
    
    const html = `
        <div class="card-panel">
            <div class="section-header">
                <div class="section-title">👥 User Management</div>
                <button class="add-btn" onclick="openCrudModal('user')">➕ Add User</button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${db.users.map(u => `
                            <tr>
                                <td>${u.name}</td>
                                <td>${u.email}</td>
                                <td><span class="badge">${u.role}</span></td>
                                <td>${u.phone || '—'}</td>
                                <td class="actions-cell">
                                    <button class="btn-edit" onclick="openCrudModal('user', ${JSON.stringify(u).replace(/"/g, '&quot;')})">Edit</button>
                                    ${u.id !== currentUser.id ? `<button class="btn-danger" onclick="deleteItem('user', ${u.id})">Delete</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('module-content').innerHTML = html;
}

function renderReports() {
    if (currentUser.role === 'Staff') {
        document.getElementById('module-content').innerHTML = '<p>Access denied. Staff cannot view reports.</p>';
        return;
    }
    
    const totalSales = db.sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalExpenses = db.expenses.reduce((sum, e) => sum + e.amount, 0);
    const net = totalSales - totalExpenses;
    
    const html = `
        <div class="card-panel">
            <div class="section-title">📊 Financial Reports</div>
            <div class="kpi-grid">
                <div class="kpi-card"><span class="kpi-label">Total Revenue</span><div class="kpi-value">$${totalSales.toFixed(2)}</div></div>
                <div class="kpi-card"><span class="kpi-label">Total Expenses</span><div class="kpi-value">$${totalExpenses.toFixed(2)}</div></div>
                <div class="kpi-card"><span class="kpi-label">Net Profit</span><div class="kpi-value" style="color: ${net >= 0 ? '#10b981' : '#ef4444'}">$${net.toFixed(2)}</div></div>
                <div class="kpi-card"><span class="kpi-label">Profit Margin</span><div class="kpi-value">${totalSales > 0 ? ((net / totalSales) * 100).toFixed(1) : 0}%</div></div>
            </div>
        </div>
        <div class="card-panel">
            <div class="section-title">📈 Inventory Status</div>
            <p>Total Products: ${db.products.length}</p>
            <p>Low Stock Items: ${db.inventory.filter(i => i.quantity < i.reorder_level).length}</p>
            <p>Out of Stock: ${db.inventory.filter(i => i.quantity === 0).length}</p>
        </div>
    `;
    document.getElementById('module-content').innerHTML = html;
}

function setNotification(msg) {
    document.getElementById('live-notification').textContent = `🔔 ${msg}`;
}

// Embedded data
function getEmbeddedExamples() {
    return {
        users: [
            { id: 1, name: "Alice Johnson", email: "alice@bizz.com", password: "pass123", role: "Owner", phone: "555-0101" },
            { id: 2, name: "Bob Smith", email: "bob@bizz.com", password: "pass123", role: "Manager", phone: "555-0102" },
            { id: 3, name: "Carol Lee", email: "carol@bizz.com", password: "pass123", role: "Staff", phone: "555-0103" },
            { id: 4, name: "David Kim", email: "david@bizz.com", password: "pass123", role: "Staff", phone: "555-0104" },
            { id: 5, name: "Elena Rossi", email: "elena@bizz.com", password: "pass123", role: "Admin", phone: "555-0105" },
            { id: 999, name: "System Admin", email: "admin@bizz.com", password: "admin123", role: "Admin", phone: "555-0000" }
        ],
        categories: [
            { id: 1, name: "Electronics" },
            { id: 2, name: "Office Supplies" },
            { id: 3, name: "Furniture" },
            { id: 4, name: "Books" },
            { id: 5, name: "Accessories" }
        ],
        products: [
            { id: 101, name: "Wireless Mouse", price: 25.99, category_id: 1 },
            { id: 102, name: "Notebook Pro", price: 9.49, category_id: 2 },
            { id: 103, name: "Desk Lamp", price: 42.00, category_id: 3 },
            { id: 104, name: "Business Planner", price: 18.75, category_id: 4 },
            { id: 105, name: "Laptop Stand", price: 35.50, category_id: 5 }
        ],
        inventory: [
            { product_id: 101, quantity: 23, reorder_level: 10, last_updated: "2026-04-10" },
            { product_id: 102, quantity: 8, reorder_level: 15, last_updated: "2026-04-11" },
            { product_id: 103, quantity: 12, reorder_level: 5, last_updated: "2026-04-09" },
            { product_id: 104, quantity: 30, reorder_level: 12, last_updated: "2026-04-12" },
            { product_id: 105, quantity: 7, reorder_level: 8, last_updated: "2026-04-08" }
        ],
        customers: [
            { id: 201, name: "TechCorp", email: "contact@techcorp.com", phone: "555-2001" },
            { id: 202, name: "PaperStreet", email: "orders@paperstreet.co", phone: "555-2002" },
            { id: 203, name: "HomeOffice Inc", email: "hello@homeoffice.com", phone: "555-2003" },
            { id: 204, name: "BookNook", email: "buy@booknook.net", phone: "555-2004" },
            { id: 205, name: "Urban Desk", email: "sales@urbandesk.io", phone: "555-2005" }
        ],
        sales: [
            { id: 301, user_id: 2, customer_id: 201, date: "2026-04-01", total_amount: 109.96 },
            { id: 302, user_id: 3, customer_id: 202, date: "2026-04-02", total_amount: 51.99 },
            { id: 303, user_id: 1, customer_id: 203, date: "2026-04-03", total_amount: 84.50 },
            { id: 304, user_id: 2, customer_id: 204, date: "2026-04-05", total_amount: 37.50 },
            { id: 305, user_id: 4, customer_id: 205, date: "2026-04-07", total_amount: 25.99 }
        ],
        saleItems: [
            { id: 401, sale_id: 301, product_id: 101, quantity: 2, price: 25.99 },
            { id: 402, sale_id: 301, product_id: 103, quantity: 1, price: 42.00 },
            { id: 403, sale_id: 302, product_id: 102, quantity: 3, price: 9.49 },
            { id: 404, sale_id: 303, product_id: 105, quantity: 2, price: 35.50 },
            { id: 405, sale_id: 304, product_id: 104, quantity: 2, price: 18.75 }
        ],
        expenses: [
            { id: 501, description: "Office rent", amount: 1200.00, category: "Rent", date: "2026-04-01" },
            { id: 502, description: "Printer ink", amount: 89.99, category: "Supplies", date: "2026-04-03" },
            { id: 503, description: "Internet bill", amount: 79.99, category: "Utilities", date: "2026-04-05" },
            { id: 504, description: "Marketing ads", amount: 250.00, category: "Marketing", date: "2026-04-07" },
            { id: 505, description: "Software subscription", amount: 29.90, category: "Software", date: "2026-04-09" }
        ]
    };
}

// Start app
window.onload = initApp;