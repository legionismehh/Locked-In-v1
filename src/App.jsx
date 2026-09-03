import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [activeTab, setActiveTab] = useState('gym'); // 'gym' or 'nutrition'
  const [gymSubTab, setGymSubTab] = useState('templates'); // 'templates' or 'history'

  // Templates & Active Workout State
  const [templates, setTemplates] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null); // Active session data
  const [history, setHistory] = useState([]);

  // New Template Form State
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateExercises, setNewTemplateExercises] = useState(['']);

  // Nutrition State
  const [nutritionLogs, setNutritionLogs] = useState([]);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchHistory();
    fetchNutrition();
  }, []);

  // --- SUPABASE FETCH HELPERS ---
  const fetchTemplates = async () => {
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const fetchHistory = async () => {
    const { data } = await supabase.from('workout_logs').select('*').order('completed_at', { ascending: false });
    if (data) setHistory(data);
  };

  const fetchNutrition = async () => {
    const { data } = await supabase.from('nutrition_logs').select('*').order('logged_at', { ascending: false });
    if (data) setNutritionLogs(data);
  };

  // --- TEMPLATE CREATION ---
  const handleAddExerciseToTemplate = () => {
    setNewTemplateExercises([...newTemplateExercises, '']);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const exercisesList = newTemplateExercises
      .filter((e) => e.trim() !== '')
      .map((name) => ({ name, sets: [{ reps: 10, weight: 135 }] }));

    const { data, error } = await supabase
      .from('templates')
      .insert([{ name: newTemplateName, exercises: exercisesList }])
      .select();

    if (!error && data) {
      setTemplates([data[0], ...templates]);
      setNewTemplateName('');
      setNewTemplateExercises(['']);
      setShowNewTemplate(false);
    }
  };

  // --- ACTIVE WORKOUT HANDLERS ---
  const startWorkout = (template) => {
    setActiveWorkout(JSON.parse(JSON.stringify(template))); // Deep clone template
  };

  const updateSet = (exIndex, setIndex, field, value) => {
    const updated = { ...activeWorkout };
    updated.exercises[exIndex].sets[setIndex][field] = Number(value);
    setActiveWorkout(updated);
  };

  const addSet = (exIndex) => {
    const updated = { ...activeWorkout };
    const lastSet = updated.exercises[exIndex].sets.slice(-1)[0] || { reps: 10, weight: 100 };
    updated.exercises[exIndex].sets.push({ ...lastSet });
    setActiveWorkout(updated);
  };

  const removeSet = (exIndex, setIndex) => {
    const updated = { ...activeWorkout };
    updated.exercises[exIndex].sets.splice(setIndex, 1);
    setActiveWorkout(updated);
  };

  const finishWorkout = async () => {
    if (!activeWorkout) return;
    const { error } = await supabase.from('workout_logs').insert([
      {
        template_name: activeWorkout.name,
        exercises: activeWorkout.exercises,
      },
    ]);

    if (!error) {
      setActiveWorkout(null);
      fetchHistory();
      setGymSubTab('history');
    }
  };

  // --- NUTRITION HANDLERS ---
  const handleLogNutrition = async (e) => {
    e.preventDefault();
    if (!foodName) return;

    const log = {
      food_name: foodName,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    };

    const { data, error } = await supabase.from('nutrition_logs').insert([log]).select();

    if (!error && data) {
      setNutritionLogs([data[0], ...nutritionLogs]);
      setFoodName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    }
  };

  const deleteNutritionLog = async (id) => {
    const { error } = await supabase.from('nutrition_logs').delete().eq('id', id);
    if (!error) {
      setNutritionLogs(nutritionLogs.filter((item) => item.id !== id));
    }
  };

  // Nutrition Totals Calculation
  const totalCal = nutritionLogs.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalPro = nutritionLogs.reduce((acc, curr) => acc + (curr.protein || 0), 0);
  const totalCarb = nutritionLogs.reduce((acc, curr) => acc + (curr.carbs || 0), 0);
  const totalFat = nutritionLogs.reduce((acc, curr) => acc + (curr.fat || 0), 0);

  return (
    <div style={styles.appContainer}>
      {/* HEADER */}
      <header style={styles.header}>
        <h1 style={styles.title}>LOCKED IN</h1>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={styles.content}>
        {activeTab === 'gym' ? (
          <div>
            {/* SUB NAVIGATION FOR GYM */}
            {!activeWorkout && (
              <div style={styles.subTabNav}>
                <button
                  style={gymSubTab === 'templates' ? styles.activeSubTab : styles.subTab}
                  onClick={() => setGymSubTab('templates')}
                >
                  Templates
                </button>
                <button
                  style={gymSubTab === 'history' ? styles.activeSubTab : styles.subTab}
                  onClick={() => setGymSubTab('history')}
                >
                  History
                </button>
              </div>
            )}

            {/* ACTIVE WORKOUT SESSION */}
            {activeWorkout ? (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: '#00E676', margin: 0 }}>Active: {activeWorkout.name}</h2>
                  <button style={styles.cancelBtn} onClick={() => setActiveWorkout(null)}>
                    Cancel
                  </button>
                </div>

                {activeWorkout.exercises.map((ex, exIdx) => (
                  <div key={exIdx} style={styles.exerciseBox}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#FFF' }}>{ex.name}</h4>
                    {ex.sets.map((set, sIdx) => (
                      <div key={sIdx} style={styles.setRow}>
                        <span style={{ color: '#888', width: '20px' }}>#{sIdx + 1}</span>
                        <input
                          type="number"
                          placeholder="Lbs"
                          value={set.weight}
                          onChange={(e) => updateSet(exIdx, sIdx, 'weight', e.target.value)}
                          style={styles.setFormInput}
                        />
                        <span style={{ color: '#888' }}>lbs x</span>
                        <input
                          type="number"
                          placeholder="Reps"
                          value={set.reps}
                          onChange={(e) => updateSet(exIdx, sIdx, 'reps', e.target.value)}
                          style={styles.setFormInput}
                        />
                        <span style={{ color: '#888' }}>reps</span>
                        <button style={styles.iconBtn} onClick={() => removeSet(exIdx, sIdx)}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button style={styles.secondaryBtn} onClick={() => addSet(exIdx)}>
                      + Add Set
                    </button>
                  </div>
                ))}

                <button style={styles.primaryBtn} onClick={finishWorkout}>
                  Finish & Save Workout
                </button>
              </div>
            ) : (
              /* TEMPLATES VIEW */
              gymSubTab === 'templates' && (
                <div>
                  {!showNewTemplate ? (
                    <button style={styles.primaryBtn} onClick={() => setShowNewTemplate(true)}>
                      + Create New Template
                    </button>
                  ) : (
                    <div style={styles.card}>
                      <h3>New Template</h3>
                      <input
                        type="text"
                        placeholder="Template Name (e.g. Push Day)"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        style={styles.input}
                      />
                      <h4>Exercises</h4>
                      {newTemplateExercises.map((ex, idx) => (
                        <input
                          key={idx}
                          type="text"
                          placeholder={`Exercise ${idx + 1}`}
                          value={ex}
                          onChange={(e) => {
                            const updated = [...newTemplateExercises];
                            updated[idx] = e.target.value;
                            setNewTemplateExercises(updated);
                          }}
                          style={{ ...styles.input, marginBottom: '8px' }}
                        />
                      ))}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={styles.secondaryBtn} onClick={handleAddExerciseToTemplate}>
                          + Add Exercise
                        </button>
                        <button style={styles.primaryBtn} onClick={handleSaveTemplate}>
                          Save Template
                        </button>
                      </div>
                    </div>
                  )}

                  {templates.map((tpl) => (
                    <div key={tpl.id} style={styles.card}>
                      <h3 style={{ margin: '0 0 8px 0' }}>{tpl.name}</h3>
                      <p style={{ color: '#AAA', fontSize: '0.9rem', marginBottom: '12px' }}>
                        {tpl.exercises ? tpl.exercises.map((e) => e.name).join(', ') : 'No exercises listed'}
                      </p>
                      <button style={styles.startBtn} onClick={() => startWorkout(tpl)}>
                        Start Workout
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* HISTORY VIEW */}
            {!activeWorkout && gymSubTab === 'history' && (
              <div>
                {history.map((log) => (
                  <div key={log.id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: '#00E676' }}>{log.template_name}</strong>
                      <span style={{ color: '#666', fontSize: '0.8rem' }}>
                        {new Date(log.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                    {log.exercises?.map((ex, idx) => (
                      <div key={idx} style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#DDD' }}>{ex.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>
                          {ex.sets?.map((s) => `${s.weight}lbs × ${s.reps}`).join(' | ')}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* NUTRITION TAB */
          <div>
            {/* MACRO SUMMARY CARDS */}
            <div style={styles.macroGrid}>
              <div style={styles.macroCard}>
                <span style={styles.macroVal}>{totalCal}</span>
                <span style={styles.macroLbl}>Calories</span>
              </div>
              <div style={styles.macroCard}>
                <span style={styles.macroVal}>{totalPro}g</span>
                <span style={styles.macroLbl}>Protein</span>
              </div>
              <div style={styles.macroCard}>
                <span style={styles.macroVal}>{totalCarb}g</span>
                <span style={styles.macroLbl}>Carbs</span>
              </div>
              <div style={styles.macroCard}>
                <span style={styles.macroVal}>{totalFat}g</span>
                <span style={styles.macroLbl}>Fat</span>
              </div>
            </div>

            {/* LOG NUTRITION FORM */}
            <form onSubmit={handleLogNutrition} style={styles.card}>
              <h3>Log Food</h3>
              <input
                type="text"
                placeholder="Food Name (e.g. Chicken Breast)"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                style={styles.input}
              />
              <div style={styles.grid2x2}>
                <input
                  type="number"
                  placeholder="Calories"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="number"
                  placeholder="Protein (g)"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="number"
                  placeholder="Carbs (g)"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="number"
                  placeholder="Fat (g)"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  style={styles.input}
                />
              </div>
              <button type="submit" style={styles.primaryBtn}>
                Add Food Entry
              </button>
            </form>

            {/* LOGGED ENTRIES FEED */}
            {nutritionLogs.map((item) => (
              <div key={item.id} style={styles.logItem}>
                <div>
                  <strong>{item.food_name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    {item.calories} kcal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                  </div>
                </div>
                <button style={styles.cancelBtn} onClick={() => deleteNutritionLog(item.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav style={styles.bottomNav}>
        <button
          style={activeTab === 'gym' ? styles.activeNavBtn : styles.navBtn}
          onClick={() => setActiveTab('gym')}
        >
          🏋️ Gym
        </button>
        <button
          style={activeTab === 'nutrition' ? styles.activeNavBtn : styles.navBtn}
          onClick={() => setActiveTab('nutrition')}
        >
          🥗 Nutrition
        </button>
      </nav>
    </div>
  );
}

// Inline Mobile-First Dark Theme Styles
const styles = {
  appContainer: {
    backgroundColor: '#121212',
    color: '#E0E0E0',
    minHeight: '100vh',
    paddingBottom: '80px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderBottom: '1px solid #2C2C2C',
    textAlign: 'center',
  },
  title: { margin: 0, fontSize: '1.2rem', color: '#00E676', letterSpacing: '1px' },
  content: { padding: '16px', maxWidth: '500px', margin: '0 auto' },
  subTabNav: { display: 'flex', gap: '8px', marginBottom: '16px' },
  subTab: { flex: 1, padding: '8px', background: '#1E1E1E', border: 'none', color: '#888', borderRadius: '6px' },
  activeSubTab: { flex: 1, padding: '8px', background: '#2C2C2C', border: 'none', color: '#00E676', borderRadius: '6px', fontWeight: 'bold' },
  card: { backgroundColor: '#1E1E1E', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #2A2A2A' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', backgroundColor: '#2A2A2A', border: '1px solid #333', color: '#FFF', borderRadius: '6px', boxSizing: 'border-box' },
  primaryBtn: { width: '100%', padding: '12px', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' },
  secondaryBtn: { padding: '8px 12px', backgroundColor: '#2A2A2A', color: '#FFF', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' },
  startBtn: { width: '100%', padding: '10px', backgroundColor: '#2979FF', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: 'transparent', color: '#FF5252', border: 'none', fontSize: '1rem', cursor: 'pointer' },
  exerciseBox: { backgroundColor: '#252525', padding: '12px', borderRadius: '8px', margin: '12px 0' },
  setRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  setFormInput: { width: '60px', padding: '6px', backgroundColor: '#1A1A1A', border: '1px solid #444', color: '#FFF', borderRadius: '4px', textAlign: 'center' },
  iconBtn: { background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer', marginLeft: 'auto' },
  macroGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' },
  macroCard: { backgroundColor: '#1E1E1E', padding: '12px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #2A2A2A' },
  macroVal: { display: 'block', fontSize: '1rem', fontWeight: 'bold', color: '#00E676' },
  macroLbl: { fontSize: '0.7rem', color: '#888' },
  grid2x2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  logItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#1E1E1E', borderRadius: '8px', marginBottom: '8px', border: '1px solid #2A2A2A' },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#1E1E1E', borderTop: '1px solid #2C2C2C', display: 'flex', justifyContent: 'space-around', alignItems: 'center' },
  navBtn: { background: 'none', border: 'none', color: '#666', fontSize: '1rem', cursor: 'pointer' },
  activeNavBtn: { background: 'none', border: 'none', color: '#00E676', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};