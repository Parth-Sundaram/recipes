import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Search, Heart, Calendar, ShoppingCart, ChefHat, Database, Repeat } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_KEY;
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
const SPOONACULAR_API_KEY = process.env.REACT_APP_SPOONACULAR_API_KEY;
const EDAMAM_APP_ID = process.env.REACT_APP_EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.REACT_APP_EDAMAM_APP_KEY;

function GroceryMealPlanner() {
  const [activeTab, setActiveTab] = useState('pantry');
  const [pantryItems, setPantryItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [recurringItems, setRecurringItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [supabase, setSupabase] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: 'units' });

  const loadAllData = useCallback(async (client, userId) => {
    try {
      const { data: pantry } = await client.from('pantry').select('*').eq('user_id', userId);
      const { data: saved } = await client.from('saved_recipes').select('*').eq('user_id', userId);
      const { data: plan } = await client.from('meal_plan').select('*').eq('user_id', userId);
      const { data: shopping } = await client.from('shopping_list').select('*').eq('user_id', userId);
      const { data: recurring } = await client.from('recurring_items').select('*').eq('user_id', userId);

      if (pantry) setPantryItems(pantry);
      if (saved) setSavedRecipes(saved.map(r => JSON.parse(r.recipe_data)));
      if (plan) setMealPlan(plan.map(r => JSON.parse(r.recipe_data)));
      if (shopping) setShoppingList(shopping);
      if (recurring) setRecurringItems(recurring);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  const initializeSupabase = useCallback((url, key) => {
    try {
      const client = createClient(url, key);
      setSupabase(client);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (type === 'signup' && accessToken) {
        client.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user);
            loadAllData(client, session.user.id);
            window.history.replaceState({}, document.title, window.location.pathname);
            alert('Email verified! Welcome to the app!');
          }
        });
      } else {
        client.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user);
            loadAllData(client, session.user.id);
            setShowAuth(false);
          } else {
            setShowAuth(true);
          }
        });
      }

      client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(session.user);
          loadAllData(client, session.user.id);
          setShowAuth(false);
        } else {
          setUser(null);
          setShowAuth(true);
        }
      });
    } catch (error) {
      console.error('Error initializing Supabase:', error);
      alert('Error connecting to Supabase. Please check your credentials.');
    }
  }, [loadAllData]);

  useEffect(() => {
    initializeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, [initializeSupabase]);

  // Auth Functions
  const handleSignup = async () => {
    if (!authEmail || !authPassword) { alert('Please enter email and password'); return; }
    if (authPassword.length < 6) { alert('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) throw error;
      alert('Account created! Please check your email to verify your account.');
      setAuthEmail(''); setAuthPassword(''); setAuthMode('login');
    } catch (error) {
      alert('Error signing up: ' + error.message);
    } finally { setIsLoading(false); }
  };

  const handleLogin = async () => {
    if (!authEmail || !authPassword) { alert('Please enter email and password'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) throw error;
      setAuthEmail(''); setAuthPassword('');
    } catch (error) {
      alert('Error logging in: ' + error.message);
    } finally { setIsLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setPantryItems([]); setRecipes([]); setSavedRecipes([]);
      setMealPlan([]); setShoppingList([]); setRecurringItems([]);
    } catch (error) {
      alert('Error logging out: ' + error.message);
    }
  };

  // Pantry Management
  const addPantryItem = async () => {
    if (!newItem.name || !newItem.quantity || !supabase || !user) return;
    const item = {
      user_id: user.id,
      name: newItem.name.toLowerCase().trim(),
      quantity: parseFloat(newItem.quantity),
      unit: newItem.unit,
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('pantry').insert([item]).select();
    if (!error && data) { setPantryItems([...pantryItems, data[0]]); setNewItem({ name: '', quantity: '', unit: 'units' }); }
  };

  const removePantryItem = async (id) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('pantry').delete().eq('id', id);
    if (!error) setPantryItems(pantryItems.filter(item => item.id !== id));
  };

  const updatePantryItem = async (id, field, value) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('pantry').update({ [field]: value }).eq('id', id);
    if (!error) setPantryItems(pantryItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Recipe Suggestions with Groq AI
  const getRecipeSuggestions = async () => {
    if (pantryItems.length === 0) { alert('Please add some pantry items first!'); return; }
    if (!GROQ_API_KEY) { alert('Please configure your Groq API key'); return; }
    setIsLoading(true); setActiveTab('recipes');
    try {
      const pantryList = pantryItems.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "user",
            content: `I have these pantry items: ${pantryList}\n\nGenerate 5 recipe suggestions that use as many of my pantry items as possible, are high protein, low fat, low preservatives, healthy and clean eating focused.\n\nRespond ONLY with a JSON array (no markdown, no preamble):\n[\n  {\n    "name": "Recipe Name",\n    "prepTime": "20 min",\n    "servings": 4,\n    "protein": "35g",\n    "fat": "8g",\n    "ingredients": [\n      {"item": "ingredient name", "amount": "quantity", "inPantry": true}\n    ],\n    "instructions": ["step 1", "step 2"],\n    "matchPercentage": 75\n  }\n]`
          }],
          temperature: 0.7,
          max_tokens: 4000
        })
      });
      const data = await response.json();
      let recipeText = data.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsedRecipes = JSON.parse(recipeText);
      setRecipes(parsedRecipes.map(r => ({ ...r, id: Date.now() + Math.random() })));
    } catch (error) {
      console.error('Error getting recipes:', error);
      alert('Error generating recipes. Please check your Groq API key and try again.');
    } finally { setIsLoading(false); }
  };

  // Multi-Source Recipe Search
  const searchRecipesFromDB = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    let allRecipes = [];

    try {
      // SOURCE 1: Spoonacular
      if (SPOONACULAR_API_KEY) {
        try {
          const spoonRes = await fetch(`https://api.spoonacular.com/recipes/complexSearch?query=${searchQuery}&number=5&addRecipeInformation=true&fillIngredients=true&apiKey=${SPOONACULAR_API_KEY}`);
          const spoonData = await spoonRes.json();
          if (spoonData.results?.length > 0) {
            const spoonRecipes = spoonData.results.map(recipe => {
              const ingredients = recipe.extendedIngredients?.map(ing => ({
                item: ing.name.toLowerCase(), amount: `${ing.amount} ${ing.unit}`,
                inPantry: pantryItems.some(p => p.name.toLowerCase().includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p.name.toLowerCase()))
              })) || [];
              return {
                id: Date.now() + Math.random(), name: recipe.title,
                prepTime: `${recipe.readyInMinutes || 30} min`, servings: recipe.servings || 4,
                protein: `${Math.round(recipe.nutrition?.nutrients?.find(n => n.name === 'Protein')?.amount || 25)}g`,
                fat: `${Math.round(recipe.nutrition?.nutrients?.find(n => n.name === 'Fat')?.amount || 12)}g`,
                ingredients, instructions: recipe.analyzedInstructions?.[0]?.steps?.map(s => s.step) || ['See full recipe for detailed instructions'],
                matchPercentage: ingredients.length > 0 ? Math.round((ingredients.filter(i => i.inPantry).length / ingredients.length) * 100) : 0,
                thumbnail: recipe.image, source: 'Spoonacular'
              };
            });
            allRecipes = [...allRecipes, ...spoonRecipes];
          }
        } catch (e) { console.log('Spoonacular failed:', e.message); }
      }

      // SOURCE 2: Edamam
      if (EDAMAM_APP_ID && EDAMAM_APP_KEY) {
        try {
          const edamamRes = await fetch(`https://api.edamam.com/api/recipes/v2?type=public&q=${searchQuery}&app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&to=5`);
          const edamamData = await edamamRes.json();
          if (edamamData.hits?.length > 0) {
            const edamamRecipes = edamamData.hits.map(hit => {
              const recipe = hit.recipe;
              const ingredients = recipe.ingredients?.map(ing => ({
                item: ing.food.toLowerCase(), amount: ing.text,
                inPantry: pantryItems.some(p => p.name.toLowerCase().includes(ing.food.toLowerCase()) || ing.food.toLowerCase().includes(p.name.toLowerCase()))
              })) || [];
              return {
                id: Date.now() + Math.random(), name: recipe.label,
                prepTime: `${recipe.totalTime || 30} min`, servings: recipe.yield || 4,
                protein: `${Math.round(recipe.totalNutrients?.PROCNT?.quantity || 25)}g`,
                fat: `${Math.round(recipe.totalNutrients?.FAT?.quantity || 12)}g`,
                ingredients, instructions: ['Visit source for full instructions: ' + recipe.url],
                matchPercentage: ingredients.length > 0 ? Math.round((ingredients.filter(i => i.inPantry).length / ingredients.length) * 100) : 0,
                thumbnail: recipe.image, source: 'Edamam', url: recipe.url
              };
            });
            allRecipes = [...allRecipes, ...edamamRecipes];
          }
        } catch (e) { console.log('Edamam failed:', e.message); }
      }

      // SOURCE 3: TheMealDB
      try {
        const mealRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${searchQuery}`);
        const mealData = await mealRes.json();
        if (mealData.meals?.length > 0) {
          const mealRecipes = mealData.meals.slice(0, 3).map(meal => {
            const ingredients = [];
            for (let i = 1; i <= 20; i++) {
              const ingredient = meal[`strIngredient${i}`];
              const measure = meal[`strMeasure${i}`];
              if (ingredient?.trim()) {
                ingredients.push({
                  item: ingredient.toLowerCase(), amount: measure || '1',
                  inPantry: pantryItems.some(p => p.name.toLowerCase().includes(ingredient.toLowerCase()) || ingredient.toLowerCase().includes(p.name.toLowerCase()))
                });
              }
            }
            return {
              id: Date.now() + Math.random(), name: meal.strMeal,
              prepTime: "30 min", servings: 4, protein: "25g", fat: "12g",
              ingredients,
              instructions: meal.strInstructions.split('\n').filter(s => s.trim()),
              matchPercentage: ingredients.length > 0 ? Math.round((ingredients.filter(i => i.inPantry).length / ingredients.length) * 100) : 0,
              category: meal.strCategory, area: meal.strArea,
              thumbnail: meal.strMealThumb, source: 'TheMealDB'
            };
          });
          allRecipes = [...allRecipes, ...mealRecipes];
        }
      } catch (e) { console.log('TheMealDB failed:', e.message); }

      // SOURCE 4: Groq AI fallback
      if (allRecipes.length === 0) {
        if (!GROQ_API_KEY) { alert('No recipes found. Please add API keys.'); setIsLoading(false); return; }
        const pantryList = pantryItems.map(i => i.name).join(', ');
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{
              role: "user",
              content: `Generate 5 recipes for: "${searchQuery}"\n\nMy pantry items: ${pantryList || 'none'}\n\nRespond ONLY with a JSON array (no markdown, no preamble):\n[\n  {\n    "name": "Recipe Name",\n    "prepTime": "20 min",\n    "servings": 4,\n    "protein": "35g",\n    "fat": "8g",\n    "ingredients": [{"item": "ingredient name", "amount": "quantity", "inPantry": false}],\n    "instructions": ["step 1", "step 2"],\n    "matchPercentage": 50\n  }\n]`
            }],
            temperature: 0.7, max_tokens: 4000
          })
        });
        const aiData = await aiResponse.json();
        let recipeText = aiData.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        allRecipes = JSON.parse(recipeText).map(r => ({ ...r, id: Date.now() + Math.random(), source: 'AI Generated' }));
      }

      // Deduplicate and sort
      const unique = allRecipes.reduce((acc, recipe) => {
        if (!acc.find(r => r.name.toLowerCase() === recipe.name.toLowerCase())) acc.push(recipe);
        return acc;
      }, []);
      unique.sort((a, b) => b.matchPercentage - a.matchPercentage);
      setRecipes(unique);
    } catch (error) {
      console.error('Error searching recipes:', error);
      alert('Error searching recipes: ' + error.message);
    } finally { setIsLoading(false); }
  };

  // Save / unsave recipe
  const saveRecipe = async (recipe) => {
    if (!supabase || !user) return;
    if (savedRecipes.find(r => r.name === recipe.name)) { alert('Recipe already saved!'); return; }
    const { data, error } = await supabase.from('saved_recipes').insert([{ user_id: user.id, recipe_data: JSON.stringify(recipe), created_at: new Date().toISOString() }]).select();
    if (!error && data) setSavedRecipes([...savedRecipes, recipe]);
  };

  const removeSavedRecipe = async (recipeName) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('saved_recipes').delete().eq('user_id', user.id).eq('recipe_data', JSON.stringify(savedRecipes.find(r => r.name === recipeName)));
    if (!error) setSavedRecipes(savedRecipes.filter(r => r.name !== recipeName));
  };

  // Meal planning
  const addToMealPlan = async (recipe) => {
    if (!supabase || !user) return;
    const recipeWithId = { ...recipe, plannedId: Date.now() + Math.random() };
    const { data, error } = await supabase.from('meal_plan').insert([{ user_id: user.id, recipe_data: JSON.stringify(recipeWithId), created_at: new Date().toISOString() }]).select();
    if (!error && data) { setMealPlan([...mealPlan, recipeWithId]); setActiveTab('mealPlan'); }
  };

  const removeFromMealPlan = async (plannedId) => {
    if (!supabase || !user) return;
    const recipe = mealPlan.find(r => r.plannedId === plannedId);
    const { error } = await supabase.from('meal_plan').delete().eq('user_id', user.id).eq('recipe_data', JSON.stringify(recipe));
    if (!error) setMealPlan(mealPlan.filter(r => r.plannedId !== plannedId));
  };

  const addMissingToShoppingList = async (recipe) => {
    if (!supabase || !user) return;
    const missingIngredients = recipe.ingredients.filter(ing => !ing.inPantry);
    if (missingIngredients.length === 0) { alert('You have all ingredients for this recipe!'); return; }
    if (!window.confirm(`Add ${missingIngredients.length} missing ingredients to shopping list?`)) return;
    const newItems = missingIngredients.map(ing => ({ user_id: user.id, item: ing.item, amount: ing.amount, recipe: recipe.name, purchased: false, created_at: new Date().toISOString() }));
    const { data, error } = await supabase.from('shopping_list').insert(newItems).select();
    if (!error && data) { setShoppingList([...shoppingList, ...data]); setActiveTab('shopping'); }
  };

  const togglePurchased = async (id) => {
    if (!supabase || !user) return;
    const item = shoppingList.find(i => i.id === id);
    const { error } = await supabase.from('shopping_list').update({ purchased: !item.purchased }).eq('id', id);
    if (!error) setShoppingList(shoppingList.map(i => i.id === id ? { ...i, purchased: !i.purchased } : i));
  };

  const removeFromShopping = async (id) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('shopping_list').delete().eq('id', id);
    if (!error) setShoppingList(shoppingList.filter(item => item.id !== id));
  };

  const clearPurchased = async () => {
    if (!supabase || !user) return;
    const purchasedIds = shoppingList.filter(i => i.purchased).map(i => i.id);
    const { error } = await supabase.from('shopping_list').delete().in('id', purchasedIds);
    if (!error) setShoppingList(shoppingList.filter(item => !item.purchased));
  };

  // Recurring Items
  const addRecurringItem = async (item, amount, frequency = 'weekly') => {
    if (!supabase || !item || !amount) return;
    const newRecurring = { user_id: user.id, item: item.toLowerCase().trim(), amount, frequency, active: true, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('recurring_items').insert([newRecurring]).select();
    if (!error && data) setRecurringItems([...recurringItems, data[0]]);
  };

  const removeRecurringItem = async (id) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('recurring_items').delete().eq('id', id);
    if (!error) setRecurringItems(recurringItems.filter(item => item.id !== id));
  };

  const toggleRecurringActive = async (id) => {
    if (!supabase || !user) return;
    const item = recurringItems.find(i => i.id === id);
    const { error } = await supabase.from('recurring_items').update({ active: !item.active }).eq('id', id);
    if (!error) setRecurringItems(recurringItems.map(i => i.id === id ? { ...i, active: !i.active } : i));
  };

  const updateRecurringItem = async (id, field, value) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('recurring_items').update({ [field]: value }).eq('id', id);
    if (!error) setRecurringItems(recurringItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addActiveRecurringToShoppingList = async () => {
    if (!supabase || !user) return;
    const activeItems = recurringItems.filter(i => i.active);
    if (activeItems.length === 0) { alert('No active recurring items to add!'); return; }
    if (!window.confirm(`Add ${activeItems.length} recurring items to shopping list?`)) return;
    const newItems = activeItems.map(item => ({ user_id: user.id, item: item.item, amount: item.amount, recipe: `Recurring (${item.frequency})`, purchased: false, created_at: new Date().toISOString() }));
    const { data, error } = await supabase.from('shopping_list').insert(newItems).select();
    if (!error && data) { setShoppingList([...shoppingList, ...data]); alert(`Added ${activeItems.length} recurring items to shopping list!`); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="max-w-6xl mx-auto p-6">

        {/* Header */}
        <header className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-emerald-800 flex items-center gap-3">
                <ChefHat className="w-8 h-8" />
                Smart Grocery & Meal Planner
              </h1>
              <p className="text-emerald-600 mt-2">
                AI-powered meal planning with cloud sync
                {user && <span className="ml-2">• {user.email}</span>}
              </p>
            </div>
            {user && (
              <button onClick={handleLogout} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">
                Logout
              </button>
            )}
          </div>
        </header>

        {/* Auth Modal */}
        {showAuth && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="text-center mb-6">
                <ChefHat className="w-16 h-16 mx-auto mb-4 text-emerald-600" />
                <h2 className="text-2xl font-bold text-emerald-800">
                  {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
                </h2>
                <p className="text-emerald-600 mt-2">
                  {authMode === 'login' ? 'Login to access your meal plans' : 'Sign up to start meal planning'}
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-2">Email</label>
                  <input
                    type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleSignup())}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-2">Password</label>
                  <input
                    type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleSignup())}
                    placeholder={authMode === 'signup' ? 'Minimum 6 characters' : 'Your password'}
                    className="w-full px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={authMode === 'login' ? handleLogin : handleSignup}
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Please wait...' : (authMode === 'login' ? 'Login' : 'Sign Up')}
                </button>
                <div className="text-center">
                  <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-emerald-600 hover:underline text-sm">
                    {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'pantry', label: 'Pantry Inventory', icon: Database },
            { id: 'recipes', label: 'Recipe Suggestions', icon: ChefHat },
            { id: 'saved', label: 'Saved Recipes', icon: Heart },
            { id: 'mealPlan', label: 'Meal Plan', icon: Calendar },
            { id: 'shopping', label: 'Shopping List', icon: ShoppingCart },
            { id: 'recurring', label: 'Recurring Items', icon: Repeat }
          ].map(tab => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pantry Tab */}
        {activeTab === 'pantry' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-emerald-800 mb-4">Your Pantry</h2>
            <div className="flex gap-3 mb-6 flex-wrap">
              <input type="text" placeholder="Item name" value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="flex-1 min-w-[200px] px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <input type="number" placeholder="Quantity" value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className="w-32 px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {['units','lbs','oz','cups','tbsp','tsp'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={addPantryItem} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {pantryItems.length === 0 ? (
              <div className="text-center py-12 text-emerald-600">
                <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No items in your pantry yet. Add some to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pantryItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                    <input type="text" value={item.name} onChange={(e) => updatePantryItem(item.id, 'name', e.target.value)}
                      className="flex-1 px-3 py-1 bg-white border border-emerald-200 rounded" />
                    <input type="number" value={item.quantity} onChange={(e) => updatePantryItem(item.id, 'quantity', parseFloat(e.target.value))}
                      className="w-24 px-3 py-1 bg-white border border-emerald-200 rounded" />
                    <select value={item.unit} onChange={(e) => updatePantryItem(item.id, 'unit', e.target.value)}
                      className="px-3 py-1 bg-white border border-emerald-200 rounded"
                    >
                      {['units','lbs','oz','cups','tbsp','tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button onClick={() => removePantryItem(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 pt-6 border-t border-emerald-200">
              <button onClick={getRecipeSuggestions} disabled={isLoading || pantryItems.length === 0}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating Recipes...' : 'Get AI Recipe Suggestions'}
              </button>
            </div>
          </div>
        )}

        {/* Recipes Tab */}
        {activeTab === 'recipes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-emerald-800 mb-4">Search Recipe Database</h2>
              <div className="flex gap-3">
                <input type="text" placeholder="Search recipes (e.g., 'chicken', 'pasta', 'vegetarian')"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchRecipesFromDB()}
                  className="flex-1 px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button onClick={searchRecipesFromDB} disabled={isLoading}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  <Search className="w-4 h-4" /> Search
                </button>
              </div>
              <p className="text-xs text-emerald-600 mt-2">Powered by TheMealDB + AI fallback</p>
            </div>
            {isLoading && (
              <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p className="text-emerald-600">Finding the perfect recipes for you...</p>
              </div>
            )}
            {!isLoading && recipes.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                <ChefHat className="w-16 h-16 mx-auto mb-4 text-emerald-300" />
                <p className="text-emerald-600">Use the search above or go to Pantry to get AI suggestions!</p>
              </div>
            )}
            <div className="space-y-4">
              {recipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe}
                  onSave={() => saveRecipe(recipe)}
                  onAddToPlan={() => addToMealPlan(recipe)}
                  onAddToShopping={() => addMissingToShoppingList(recipe)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Saved Recipes Tab */}
        {activeTab === 'saved' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-emerald-800 mb-4">Saved Recipes</h2>
            {savedRecipes.length === 0 ? (
              <div className="text-center py-12 text-emerald-600">
                <Heart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No saved recipes yet. Save some from the Recipes tab!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedRecipes.map(recipe => (
                  <RecipeCard key={recipe.id} recipe={recipe}
                    onAddToPlan={() => addToMealPlan(recipe)}
                    onAddToShopping={() => addMissingToShoppingList(recipe)}
                    onDelete={() => removeSavedRecipe(recipe.name)}
                    isSaved
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meal Plan Tab */}
        {activeTab === 'mealPlan' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-emerald-800 mb-4">Weekly Meal Plan</h2>
            {mealPlan.length === 0 ? (
              <div className="text-center py-12 text-emerald-600">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No meals planned yet. Add recipes from the Recipes or Saved tabs!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mealPlan.map(recipe => (
                  <div key={recipe.plannedId} className="border border-emerald-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-emerald-800">{recipe.name}</h3>
                      <button onClick={() => removeFromMealPlan(recipe.plannedId)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button onClick={() => addMissingToShoppingList(recipe)}
                      className="w-full py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 flex items-center justify-center gap-2 font-medium"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add Missing Ingredients to Shopping List
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shopping List Tab */}
        {activeTab === 'shopping' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-emerald-800">Shopping List</h2>
              <div className="flex gap-2">
                <button onClick={addActiveRecurringToShoppingList}
                  className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-medium flex items-center gap-2"
                >
                  <Repeat className="w-4 h-4" /> Add Recurring Items
                </button>
                {shoppingList.some(item => item.purchased) && (
                  <button onClick={clearPurchased} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium">
                    Clear Purchased
                  </button>
                )}
              </div>
            </div>
            {shoppingList.length === 0 ? (
              <div className="text-center py-12 text-emerald-600">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Your shopping list is empty. Add items from your meal plan!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shoppingList.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg ${item.purchased ? 'bg-gray-100' : 'bg-emerald-50'}`}>
                    <input type="checkbox" checked={item.purchased} onChange={() => togglePurchased(item.id)}
                      className="w-5 h-5 text-emerald-600 rounded" />
                    <div className="flex-1">
                      <p className={`font-medium ${item.purchased ? 'line-through text-gray-500' : 'text-emerald-800'}`}>
                        {item.item} - {item.amount}
                      </p>
                      <p className="text-sm text-emerald-600">For: {item.recipe}</p>
                    </div>
                    <button onClick={() => removeFromShopping(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recurring Items Tab */}
        {activeTab === 'recurring' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-emerald-800 mb-4">Recurring Shopping Items</h2>
            <p className="text-emerald-600 mb-6">Items you buy regularly (like milk, eggs, bread). Add them once and easily add to your shopping list each week!</p>
            <RecurringItemForm onAdd={addRecurringItem} />
            {recurringItems.length === 0 ? (
              <div className="text-center py-12 text-emerald-600">
                <Repeat className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No recurring items yet. Add items you buy regularly!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recurringItems.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg ${item.active ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                    <input type="checkbox" checked={item.active} onChange={() => toggleRecurringActive(item.id)}
                      className="w-5 h-5 text-emerald-600 rounded"
                      title={item.active ? 'Active - will be added to shopping list' : 'Inactive - skip for now'}
                    />
                    <div className="flex-1">
                      <input type="text" value={item.item} onChange={(e) => updateRecurringItem(item.id, 'item', e.target.value)}
                        className={`font-medium px-2 py-1 bg-white border border-emerald-200 rounded ${!item.active ? 'text-gray-500' : 'text-emerald-800'}`}
                      />
                      <div className="flex gap-2 items-center mt-1">
                        <input type="text" value={item.amount} onChange={(e) => updateRecurringItem(item.id, 'amount', e.target.value)}
                          className="text-sm text-emerald-600 px-2 py-1 bg-white border border-emerald-200 rounded w-24" />
                        <select value={item.frequency} onChange={(e) => updateRecurringItem(item.id, 'frequency', e.target.value)}
                          className="text-sm text-emerald-600 px-2 py-1 bg-white border border-emerald-200 rounded"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={() => removeRecurringItem(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {recurringItems.length > 0 && (
              <div className="mt-6 pt-6 border-t border-emerald-200">
                <button onClick={addActiveRecurringToShoppingList}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 font-medium flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add Active Items to Shopping List ({recurringItems.filter(i => i.active).length})
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Recurring Item Form Component
function RecurringItemForm({ onAdd }) {
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('weekly');

  const handleSubmit = () => {
    if (!item || !amount) { alert('Please fill in item name and amount'); return; }
    onAdd(item, amount, frequency);
    setItem(''); setAmount(''); setFrequency('weekly');
  };

  return (
    <div className="bg-emerald-50 rounded-lg p-4 mb-6">
      <h3 className="font-medium text-emerald-800 mb-3">Add New Recurring Item</h3>
      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Item name (e.g., milk, eggs)" value={item}
          onChange={(e) => setItem(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <input type="text" placeholder="Amount (e.g., 1 gallon)" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-40 px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
          className="px-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button onClick={handleSubmit}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}

// Recipe Card Component
function RecipeCard({ recipe, onSave, onAddToPlan, onAddToShopping, onDelete, isSaved }) {
  const [expanded, setExpanded] = useState(false);
  const missingCount = recipe.ingredients.filter(i => !i.inPantry).length;

  return (
    <div className="bg-white border border-emerald-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-emerald-800">{recipe.name}</h3>
          <div className="flex gap-4 mt-2 text-sm text-emerald-600 flex-wrap">
            <span>⏱️ {recipe.prepTime}</span>
            <span>🍽️ {recipe.servings} servings</span>
            <span>💪 {recipe.protein} protein</span>
            <span>🥑 {recipe.fat} fat</span>
            {recipe.category && <span>🏷️ {recipe.category}</span>}
            {recipe.area && <span>🌍 {recipe.area}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-600">{recipe.matchPercentage}%</div>
          <div className="text-xs text-emerald-600">match</div>
        </div>
      </div>
      {recipe.thumbnail && (
        <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-48 object-cover rounded-lg mb-3" />
      )}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-emerald-700">Ingredients</span>
          {missingCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{missingCount} missing</span>
          )}
        </div>
        <div className="space-y-1">
          {recipe.ingredients.slice(0, expanded ? undefined : 5).map((ing, idx) => (
            <div key={idx} className={`text-sm flex items-center gap-2 ${ing.inPantry ? 'text-emerald-700' : 'text-amber-600'}`}>
              <span>{ing.inPantry ? '✓' : '○'}</span>
              <span>{ing.amount} {ing.item}</span>
            </div>
          ))}
        </div>
        {recipe.ingredients.length > 5 && (
          <button onClick={() => setExpanded(!expanded)} className="text-sm text-emerald-600 hover:underline mt-2">
            {expanded ? 'Show less' : `Show ${recipe.ingredients.length - 5} more`}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mb-3 p-3 bg-emerald-50 rounded-lg">
          <h4 className="font-medium text-emerald-800 mb-2">Instructions</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-emerald-700">
            {recipe.instructions.map((step, idx) => <li key={idx}>{step}</li>)}
          </ol>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {!isSaved && onSave && (
          <button onClick={onSave} className="px-4 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 flex items-center gap-2 text-sm font-medium">
            <Heart className="w-4 h-4" /> Save
          </button>
        )}
        <button onClick={onAddToPlan} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2 text-sm font-medium">
          <Calendar className="w-4 h-4" /> Add to Meal Plan
        </button>
        <button onClick={onAddToShopping} className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 flex items-center gap-2 text-sm font-medium">
          <ShoppingCart className="w-4 h-4" /> Shopping List
        </button>
        {isSaved && onDelete && (
          <button onClick={onDelete} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm font-medium ml-auto">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default GroceryMealPlanner;