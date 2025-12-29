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

// Family password - change this to your family password
const FAMILY_PASSWORD = "recipes123";

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
        showScreen('main');
        loadRecipes();
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
});

function handleLogin() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('login-error');

    if (password === FAMILY_PASSWORD) {
        sessionStorage.setItem('familyAuth', 'true');
        showScreen('main');
        loadRecipes();
        errorEl.textContent = '';
    } else {
        errorEl.textContent = 'Incorrect password. Try again!';
        document.getElementById('password-input').value = '';
    }
}

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function loadRecipes() {
    const listEl = document.getElementById('recipe-list');
    listEl.innerHTML = '<div class="loading">Loading recipes...</div>';

    database.ref('recipes').on('value', (snapshot) => {
        recipes = snapshot.val() || {};
        renderRecipeList();
    });
}

function renderRecipeList() {
    const listEl = document.getElementById('recipe-list');
    const recipeArray = Object.entries(recipes);

    if (recipeArray.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>No recipes yet!</p>
                <p>Tap "+ Add Recipe" to share your first family recipe.</p>
            </div>
        `;
        return;
    }

    // Sort by title
    recipeArray.sort((a, b) => a[1].title.localeCompare(b[1].title));

    listEl.innerHTML = recipeArray.map(([id, recipe]) => `
        <div class="recipe-card" data-id="${id}">
            <h3>${escapeHtml(recipe.title)}</h3>
            ${recipe.category ? `<span class="category-badge">${escapeHtml(recipe.category.replace('-', ' '))}</span>` : ''}
            <p class="source">From: ${escapeHtml(recipe.source || 'Unknown')}</p>
            <div class="quick-info">
                ${recipe.temp ? `<span>${escapeHtml(recipe.temp)}</span>` : ''}
                ${recipe.time ? `<span>${escapeHtml(recipe.time)}</span>` : ''}
            </div>
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
    if (currentRecipeId) {
        // Update existing
        saveRef = database.ref('recipes/' + currentRecipeId).update(recipeData);
    } else {
        // Create new
        recipeData.createdAt = Date.now();
        saveRef = database.ref('recipes').push(recipeData);
        currentRecipeId = saveRef.key;
    }

    saveRef.then(() => {
        viewRecipe(currentRecipeId);
    }).catch(err => {
        alert('Error saving recipe: ' + err.message);
    });
}

function deleteRecipe() {
    if (!currentRecipeId) return;

    if (confirm('Are you sure you want to delete this recipe?')) {
        database.ref('recipes/' + currentRecipeId).remove()
            .then(() => {
                currentRecipeId = null;
                showScreen('main');
            })
            .catch(err => {
                alert('Error deleting recipe: ' + err.message);
            });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
