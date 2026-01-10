// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDrI3Y7IVC_H7W4iWxvOwf-bybt3SO-u_8",
    authDomain: "familyrecipes-9809d.firebaseapp.com",
    databaseURL: "https://familyrecipes-9809d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "familyrecipes-9809d",
    storageBucket: "familyrecipes-9809d.firebasestorage.app",
    messagingSenderId: "307834373790",
    appId: "1:307834373790:web:113acb9456eebc5daa5d8f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// App State
let currentRecipeId = null;
let recipes = {};
let currentFilter = 'all';

const categoryInfo = {
    all: { emoji: '📖', name: 'All Recipes' },
    breakfast: { emoji: '🥞', name: 'Breakfast' },
    appetizer: { emoji: '🥗', name: 'Appetizer' },
    main: { emoji: '🍝', name: 'Main Dish' },
    side: { emoji: '🥔', name: 'Side Dish' },
    dessert: { emoji: '🍰', name: 'Dessert' },
    drink: { emoji: '🥤', name: 'Drink' },
    snack: { emoji: '🍿', name: 'Snack' }
};

// Passwords - change these to your own passwords
const FAMILY_PASSWORD = "recipes123";
const PERSONAL_PASSWORD = "recipes1013";

// Current mode: 'family' or 'personal'
let currentMode = 'family';

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    main: document.getElementById('main-screen'),
    view: document.getElementById('view-screen'),
    edit: document.getElementById('edit-screen')
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    if (sessionStorage.getItem('familyAuth') === 'true') {
        currentMode = sessionStorage.getItem('recipeMode') || 'family';
        showScreen('main');
        loadRecipes();
        updateModeIndicator();
    }

    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('password-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // Navigation
    document.getElementById('add-recipe-btn').addEventListener('click', () => {
        currentRecipeId = null;
        clearForm();
        document.getElementById('delete-recipe-btn').style.display = 'none';
        showScreen('edit');
    });

    document.getElementById('back-from-view').addEventListener('click', () => {
        showScreen('main');
    });

    document.getElementById('back-from-edit').addEventListener('click', () => {
        if (currentRecipeId) {
            showScreen('view');
        } else {
            showScreen('main');
        }
    });

    document.getElementById('edit-recipe-btn').addEventListener('click', () => {
        loadRecipeIntoForm(currentRecipeId);
        document.getElementById('delete-recipe-btn').style.display = 'block';
        showScreen('edit');
    });

    // Save recipe
    document.getElementById('save-recipe-btn').addEventListener('click', saveRecipe);

    // Delete recipe
    document.getElementById('delete-recipe-btn').addEventListener('click', deleteRecipe);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        // Detach database listeners
        database.ref('recipes').off();
        database.ref('personal-recipes').off();
        // Sign out from Firebase
        firebase.auth().signOut();
        // Clear session
        sessionStorage.removeItem('familyAuth');
        sessionStorage.removeItem('recipeMode');
        currentFilter = 'all';
        currentMode = 'family';
        recipes = {};
        showScreen('login');
    });

    // Auto-number steps
    setupStepsAutoNumber();
});

function handleLogin() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('login-error');

    if (password === FAMILY_PASSWORD || password === PERSONAL_PASSWORD) {
        // Set mode based on password
        currentMode = password === PERSONAL_PASSWORD ? 'personal' : 'family';

        // Sign in to Firebase anonymously
        firebase.auth().signInAnonymously()
            .then(() => {
                sessionStorage.setItem('familyAuth', 'true');
                sessionStorage.setItem('recipeMode', currentMode);
                showScreen('main');
                loadRecipes();
                updateModeIndicator();
                errorEl.textContent = '';
            })
            .catch((error) => {
                errorEl.textContent = 'Login failed: ' + error.message;
            });
    } else {
        errorEl.textContent = 'Incorrect password. Try again!';
        document.getElementById('password-input').value = '';
    }
}

function getRecipesPath() {
    return currentMode === 'personal' ? 'personal-recipes' : 'recipes';
}

function updateModeIndicator() {
    const header = document.querySelector('#main-screen header h1');
    if (header) {
        if (currentMode === 'personal') {
            header.textContent = 'Personal Recipes';
            header.style.color = '#9b59b6';
        } else {
            header.textContent = 'Family Recipes';
            header.style.color = '';
        }
    }
}

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    window.scrollTo(0, 0);
}

function loadRecipes() {
    const listEl = document.getElementById('recipe-list');
    listEl.innerHTML = '<div class="loading">Loading recipes...</div>';

    // Detach any previous listener
    database.ref('recipes').off();
    database.ref('personal-recipes').off();

    database.ref(getRecipesPath()).on('value', (snapshot) => {
        recipes = snapshot.val() || {};
        renderRecipeList();
    }, (error) => {
        console.error('Firebase error:', error);
        listEl.innerHTML = `<div class="empty-state"><p>Error loading recipes: ${error.message}</p></div>`;
    });
}

function getCategoryCounts() {
    const counts = { all: 0 };
    Object.values(recipes).forEach(recipe => {
        counts.all++;
        if (recipe.category) {
            counts[recipe.category] = (counts[recipe.category] || 0) + 1;
        }
    });
    return counts;
}

function renderCategoryFilters() {
    const filtersEl = document.getElementById('category-filters');
    const counts = getCategoryCounts();

    const categories = ['all', 'breakfast', 'appetizer', 'main', 'side', 'dessert', 'drink', 'snack'];

    filtersEl.innerHTML = categories.map(cat => {
        const info = categoryInfo[cat];
        const count = counts[cat] || 0;
        const isActive = currentFilter === cat;
        const isAll = cat === 'all';

        // Only show categories that have recipes (except "all" which always shows)
        if (!isAll && count === 0) return '';

        return `
            <button class="category-btn ${isAll ? 'all-btn' : ''} ${isActive ? 'active' : ''}" data-category="${cat}">
                <span class="emoji">${info.emoji}</span>
                <span class="name">${info.name}</span>
                <span class="count">${count} recipe${count !== 1 ? 's' : ''}</span>
            </button>
        `;
    }).join('');

    // Add click handlers
    filtersEl.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.category;
            renderCategoryFilters();
            renderRecipeList();
        });
    });
}

function renderRecipeList() {
    const listEl = document.getElementById('recipe-list');
    let recipeArray = Object.entries(recipes);

    // Render category filters first
    renderCategoryFilters();

    if (recipeArray.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>No recipes yet!</p>
                <p>Tap "+ Add" to share your first family recipe.</p>
            </div>
        `;
        return;
    }

    // Filter by category
    if (currentFilter !== 'all') {
        recipeArray = recipeArray.filter(([id, recipe]) => recipe.category === currentFilter);
    }

    if (recipeArray.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>No ${categoryInfo[currentFilter]?.name || currentFilter} recipes yet!</p>
            </div>
        `;
        return;
    }

    // Sort by title
    recipeArray.sort((a, b) => a[1].title.localeCompare(b[1].title));

    listEl.innerHTML = recipeArray.map(([id, recipe]) => `
        <div class="recipe-card" data-id="${id}">
            <h3>${escapeHtml(recipe.title)}</h3>
            ${recipe.category ? `<span class="category-badge">${escapeHtml(categoryInfo[recipe.category]?.name || recipe.category)}</span>` : ''}
            <p class="source">From: ${escapeHtml(recipe.source || 'Unknown')}</p>
        </div>
    `).join('');

    // Add click handlers
    listEl.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            viewRecipe(id);
        });
    });
}

const categoryLabels = {
    breakfast: 'Breakfast',
    appetizer: 'Appetizer',
    main: 'Main Dish',
    side: 'Side Dish',
    dessert: 'Dessert',
    drink: 'Drink',
    snack: 'Snack'
};

function viewRecipe(id) {
    currentRecipeId = id;
    const recipe = recipes[id];

    document.getElementById('view-title').textContent = recipe.title;
    document.getElementById('view-category').textContent = recipe.category ? categoryLabels[recipe.category] || recipe.category : '';
    document.getElementById('view-source').textContent = `From: ${recipe.source || 'Unknown'}`;
    document.getElementById('view-temp').textContent = recipe.temp || 'N/A';
    document.getElementById('view-time').textContent = recipe.time || 'N/A';

    // Ingredients
    const ingredientsList = document.getElementById('view-ingredients');
    const ingredients = (recipe.ingredients || '').split('\n').filter(i => i.trim());
    ingredientsList.innerHTML = ingredients.map(i => `<li>${escapeHtml(i)}</li>`).join('');

    // Steps
    const stepsList = document.getElementById('view-steps');
    const steps = (recipe.steps || '').split('\n').filter(s => s.trim());
    stepsList.innerHTML = steps.map(s => `<li>${escapeHtml(s)}</li>`).join('');

    showScreen('view');
}

function loadRecipeIntoForm(id) {
    const recipe = recipes[id];
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-title').value = recipe.title || '';
    document.getElementById('edit-source').value = recipe.source || '';
    document.getElementById('edit-category').value = recipe.category || '';
    document.getElementById('edit-temp').value = recipe.temp || '';
    document.getElementById('edit-time').value = recipe.time || '';
    document.getElementById('edit-ingredients').value = recipe.ingredients || '';
    document.getElementById('edit-steps').value = recipe.steps || '';
}

function clearForm() {
    document.getElementById('edit-id').value = '';
    document.getElementById('edit-title').value = '';
    document.getElementById('edit-source').value = '';
    document.getElementById('edit-category').value = '';
    document.getElementById('edit-temp').value = '';
    document.getElementById('edit-time').value = '';
    document.getElementById('edit-ingredients').value = '';
    document.getElementById('edit-steps').value = '';
}

function saveRecipe() {
    const title = document.getElementById('edit-title').value.trim();
    if (!title) {
        alert('Please enter a recipe title');
        return;
    }

    const recipeData = {
        title: title,
        source: document.getElementById('edit-source').value.trim(),
        category: document.getElementById('edit-category').value,
        temp: document.getElementById('edit-temp').value.trim(),
        time: document.getElementById('edit-time').value.trim(),
        ingredients: document.getElementById('edit-ingredients').value.trim(),
        steps: document.getElementById('edit-steps').value.trim(),
        updatedAt: Date.now()
    };

    let saveRef;
    const basePath = getRecipesPath();
    if (currentRecipeId) {
        // Update existing
        saveRef = database.ref(basePath + '/' + currentRecipeId).update(recipeData);
    } else {
        // Create new
        recipeData.createdAt = Date.now();
        saveRef = database.ref(basePath).push(recipeData);
        currentRecipeId = saveRef.key;
    }

    saveRef.then(() => {
        showToast('Recipe saved!');
        viewRecipe(currentRecipeId);
    }).catch(err => {
        alert('Error saving recipe: ' + err.message);
    });
}

function deleteRecipe() {
    if (!currentRecipeId) return;

    const promptText = currentMode === 'personal'
        ? 'Enter your password to delete this recipe:'
        : 'Enter the family password to delete this recipe:';
    const password = prompt(promptText);

    if (password === null) return; // User cancelled

    const correctPassword = currentMode === 'personal' ? PERSONAL_PASSWORD : FAMILY_PASSWORD;
    if (password === correctPassword) {
        database.ref(getRecipesPath() + '/' + currentRecipeId).remove()
            .then(() => {
                currentRecipeId = null;
                showToast('Recipe deleted');
                showScreen('main');
            })
            .catch(err => {
                alert('Error deleting recipe: ' + err.message);
            });
    } else {
        alert('Incorrect password. Recipe not deleted.');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Auto-number steps textarea
function setupStepsAutoNumber() {
    const stepsTextarea = document.getElementById('edit-steps');

    // When focusing on empty textarea, add "1. "
    stepsTextarea.addEventListener('focus', () => {
        if (stepsTextarea.value.trim() === '') {
            stepsTextarea.value = '1. ';
        }
    });

    // When pressing Enter, add next number
    stepsTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            const cursorPos = stepsTextarea.selectionStart;
            const text = stepsTextarea.value;

            // Count how many lines exist before cursor
            const textBeforeCursor = text.substring(0, cursorPos);
            const lineCount = textBeforeCursor.split('\n').length;
            const nextNumber = lineCount + 1;

            // Insert newline and next number
            const newText = text.substring(0, cursorPos) + '\n' + nextNumber + '. ' + text.substring(cursorPos);
            stepsTextarea.value = newText;

            // Move cursor after the number
            const newCursorPos = cursorPos + 2 + nextNumber.toString().length + 2;
            stepsTextarea.selectionStart = newCursorPos;
            stepsTextarea.selectionEnd = newCursorPos;
        }
    });
}
