import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('gym');
  const [gymSubTab, setGymSubTab] = useState('templates');

  // Gym State
  const [templates, setTemplates] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [history, setHistory] = useState([]);
  const [editingLog, setEditingLog] = useState(null);

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateExercises, setNewTemplateExercises] = useState(['']);

  // Nutrition State
  const [nutritionLogs, setNutritionLogs] = useState([]);
  const [mealLibrary, setMealLibrary] = useState([]);
  const [mealSlots, setMealSlots] = useState(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
  const [newSlotName, setNewSlotName] = useState('');

  // Library Form
  const [libName, setLibName] = useState('');
  const [libCal, setLibCal] = useState('');
  const [libPro, setLibPro] = useState('');
  const [libCarb, setLibCarb] = useState('');
  const [libFat, setLibFat] = useState('');
  const [showAddLib, setShowAddLib] = useState(false);

  // Auth & Init
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchTemplates();
      fetchHistory();
      fetchNutrition();
      fetchMealLibrary();
    }
  }, [session]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else alert('Account created! You can now log in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  // Data Fetching
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

  const fetchMealLibrary = async () => {
    const { data } = await supabase.from('meal_library').select('*').order('created_at', { ascending: false });
    if (data) setMealLibrary(data);
  };

  // GYM HANDLERS
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const exercisesList = newTemplateExercises
      .filter((e) => e.trim() !== '')
      .map((name) => ({ name, sets: [{ reps: 10, weight: 135 }] }));

    const { data, error } = await supabase
      .from('templates')
      .insert([{ name: newTemplateName, exercises: exercisesList, user_id: session.user.id }])
      .select();

    if (!error && data) {
      setTemplates([data[0], ...templates]);
      setNewTemplateName('');
      setNewTemplateExercises(['']);
      setShowNewTemplate(false);
    }
  };

  const startWorkout = (template) => setActiveWorkout(JSON.parse(JSON.stringify(template)));

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
      { template_name: activeWorkout.name, exercises: activeWorkout.exercises, user_id: session.user.id },
    ]);

    if (!error) {
      setActiveWorkout(null);
      fetchHistory();
      setGymSubTab('history');
    }
  };

  const deleteWorkoutLog = async (id) => {
    if (!window.confirm('Delete this workout log?')) return;
    const { error } = await supabase.from('workout_logs').delete().eq('id', id);
    if (!error) setHistory(history.filter((item) => item.id !== id));
  };

  const handleUpdateLog = async () => {
    if (!editingLog) return;
    const { error } = await supabase
      .from('workout_logs')
      .update({ exercises: editingLog.exercises })
      .eq('id', editingLog.id);

    if (!error) {
      setEditingLog(null);
      fetchHistory();
    }
  };

  // NUTRITION & MEAL LIBRARY HANDLERS
  const handleSaveToLibrary = async (e) => {
    e.preventDefault();
    if (!libName) return;

    const meal = {
      name: libName,
      calories: Number(libCal) || 0,
      protein: Number(libPro) || 0,
      carbs: Number(libCarb) || 0,
      fat: Number(libFat) || 0,
      user_id: session.user.id,
    };

    const { data, error } = await supabase.from('meal_library').insert([meal]).select();
    if (!error && data) {
      setMealLibrary([data[0], ...mealLibrary]);
      setLibName(''); setLibCal(''); setLibPro(''); setLibCarb(''); setLibFat('');
      setShowAddLib(false);
    }
  };

  const deleteLibraryMeal = async (id) => {
    const { error } = await supabase.from('meal_library').delete().eq('id', id);
    if (!error) setMealLibrary(mealLibrary.filter((item) => item.id !== id));
  };

  const logMealFromLibrary = async (slotName, libraryMeal) => {
    const log = {
      food_name: libraryMeal.name,
      calories: libraryMeal.calories,
      protein: libraryMeal.protein,
      carbs: libraryMeal.carbs,
      fat: libraryMeal.fat,
      slot_name: slotName,
      user_id: session.user.id,
    };

    const { data, error } = await supabase.from('nutrition_logs').insert([log]).select();
    if (!error && data) setNutritionLogs([data[0], ...nutritionLogs]);
  };

  const deleteNutritionLog = async (id) => {
    const { error } = await supabase.from('nutrition_logs').delete().eq('id', id);
    if (!error) setNutritionLogs(nutritionLogs.filter((item) => item.id !== id));
  };

  const handleAddSlot = () => {
    if (newSlotName.trim() && !mealSlots.includes(newSlotName.trim())) {
      setMealSlots([...mealSlots, newSlotName.trim()]);
      setNewSlotName('');
    }
  };

  const removeSlot = (slotToRemove) => {
    setMealSlots(mealSlots.filter((s) => s !== slotToRemove));
  };

  // Totals
  const totalCal = nutritionLogs.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalPro = nutritionLogs.reduce((acc, curr) => acc + (curr.protein || 0), 0);
  const totalCarb = nutritionLogs.reduce((acc, curr) => acc + (curr.carbs || 0), 0);
  const totalFat = nutritionLogs.reduce((acc, curr) => acc + (curr.fat || 0), 0);

  if (!session) {
    return (
      <div style={styles.appContainer}>
        <header style={styles.header}><h1 style={styles.title}>LOCKED IN</h1></header>
        <main style={styles.content}>
          <form onSubmit={handleAuth} style={styles.card}>
            <h3>{isSignUp ? 'Create Account' : 'Welcome Back'}</h3>
            {authError && <p style={{ color: '#FF5252', fontSize: '0.85rem' }}>{authError}</p>}
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
            <button type="submit" style={styles.primaryBtn}>{isSignUp ? 'Sign Up' : 'Log In'}</button>
            <p style={{ color: '#00E676', textAlign: 'center', cursor: 'pointer', marginTop: '12px', fontSize: '0.9rem' }} onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </p>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <header style={{ ...styles.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={styles.title}>LOCKED IN</h1>
        <button style={styles.logoutBtn} onClick={handleLogout}>Log Out</button>
      </header>

      <main style={styles.content}>
        {activeTab === 'gym' ? (
          <div>
            {!activeWorkout && (
              <div style={styles.subTabNav}>
                <button style={gymSubTab === 'templates' ? styles.activeSubTab : styles.subTab} onClick={() => setGymSubTab('templates')}>Templates</button>
                <button style={gymSubTab === 'history' ? styles.activeSubTab : styles.subTab} onClick={() => setGymSubTab('history')}>History</button>
              </div>
            )}

            {/* ACTIVE WORKOUT MODE */}
            {activeWorkout ? (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: '#00E676', margin: 0 }}>Active: {activeWorkout.name}</h2>
                  <button style={styles.cancelBtn} onClick={() => setActiveWorkout(null)}>Cancel</button>
                </div>

                {activeWorkout.exercises.map((ex, exIdx) => (
                  <div key={exIdx} style={styles.exerciseBox}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#FFF' }}>{ex.name}</h4>
                    {ex.sets.map((set, sIdx) => (
                      <div key={sIdx} style={styles.setRow}>
                        <span style={{ color: '#888', width: '20px' }}>#{sIdx + 1}</span>
                        <input type="number" placeholder="Lbs" value={set.weight} onChange={(e) => updateSet(exIdx, sIdx, 'weight', e.target.value)} style={styles.setFormInput} />
                        <span style={{ color: '#888' }}>lbs x</span>
                        <input type="number" placeholder="Reps" value={set.reps} onChange={(e) => updateSet(exIdx, sIdx, 'reps', e.target.value)} style={styles.setFormInput} />
                        <span style={{ color: '#888' }}>reps</span>
                        <button style={styles.iconBtn} onClick={() => removeSet(exIdx, sIdx)}>✕</button>
                      </div>
                    ))}
                    <button style={styles.secondaryBtn} onClick={() => addSet(exIdx)}>+ Add Set</button>
                  </div>
                ))}

                <button style={styles.primaryBtn} onClick={finishWorkout}>Finish & Save Workout</button>
              </div>
            ) : (
              gymSubTab === 'templates' && (
                <div>
                  {!showNewTemplate ? (
                    <button style={styles.primaryBtn} onClick={() => setShowNewTemplate(true)}>+ Create New Template</button>
                  ) : (
                    <div style={styles.card}>
                      <h3>New Template</h3>
                      <input type="text" placeholder="Template Name" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} style={styles.input} />
                      <h4>Exercises</h4>
                      {newTemplateExercises.map((ex, idx) => (
                        <input key={idx} type="text" placeholder={`Exercise ${idx + 1}`} value={ex} onChange={(e) => {
                          const updated = [...newTemplateExercises]; updated[idx] = e.target.value; setNewTemplateExercises(updated);
                        }} style={{ ...styles.input, marginBottom: '8px' }} />
                      ))}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={styles.secondaryBtn} onClick={() => setNewTemplateExercises([...newTemplateExercises, ''])}>+ Add Exercise</button>
                        <button style={styles.primaryBtn} onClick={handleSaveTemplate}>Save Template</button>
                      </div>
                    </div>
                  )}

                  {templates.map((tpl) => (
                    <div key={tpl.id} style={styles.card}>
                      <h3 style={{ margin: '0 0 8px 0' }}>{tpl.name}</h3>
                      <p style={{ color: '#AAA', fontSize: '0.9rem', marginBottom: '12px' }}>{tpl.exercises ? tpl.exercises.map((e) => e.name).join(', ') : 'No exercises'}</p>
                      <button style={styles.startBtn} onClick={() => startWorkout(tpl)}>Start Workout</button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* WORKOUT HISTORY SUB-TAB */}
            {!activeWorkout && gymSubTab === 'history' && (
              <div>
                {/* LOG EDITING MODAL */}
                {editingLog && (
                  <div style={{ ...styles.card, borderColor: '#00E676' }}>
                    <h3 style={{ color: '#00E676' }}>Editing: {editingLog.template_name}</h3>
                    {editingLog.exercises.map((ex, exIdx) => (
                      <div key={exIdx} style={styles.exerciseBox}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#FFF' }}>{ex.name}</h4>
                        {ex.sets.map((set, sIdx) => (
                          <div key={sIdx} style={styles.setRow}>
                            <span style={{ color: '#888' }}>#{sIdx + 1}</span>
                            <input
                              type="number"
                              value={set.weight}
                              onChange={(e) => {
                                const updated = { ...editingLog };
                                updated.exercises[exIdx].sets[sIdx].weight = Number(e.target.value);
                                setEditingLog(updated);
                              }}
                              style={styles.setFormInput}
                            />
                            <span style={{ color: '#888' }}>lbs</span>
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) => {
                                const updated = { ...editingLog };
                                updated.exercises[exIdx].sets[sIdx].reps = Number(e.target.value);
                                setEditingLog(updated);
                              }}
                              style={styles.setFormInput}
                            />
                            <span style={{ color: '#888' }}>reps</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={styles.primaryBtn} onClick={handleUpdateLog}>Save Changes</button>
                      <button style={{ ...styles.secondaryBtn, width: '100%', marginTop: '8px' }} onClick={() => setEditingLog(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {history.map((log) => (
                  <div key={log.id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                      <strong style={{ color: '#00E676' }}>{log.template_name}</strong>
                      <div>
                        <button style={{ ...styles.secondaryBtn, padding: '2px 8px', fontSize: '0.75rem', marginRight: '6px' }} onClick={() => setEditingLog(JSON.parse(JSON.stringify(log)))}>Edit</button>
                        <button style={{ ...styles.cancelBtn, fontSize: '0.85rem' }} onClick={() => deleteWorkoutLog(log.id)}>✕</button>
                      </div>
                    </div>
                    <span style={{ color: '#666', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>{new Date(log.completed_at).toLocaleDateString()}</span>
                    {log.exercises?.map((ex, idx) => (
                      <div key={idx} style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#DDD' }}>{ex.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{ex.sets?.map((s) => `${s.weight}lbs × ${s.reps}`).join(' | ')}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* NUTRITION & MEAL LIBRARY TAB */
          <div>
            <div style={styles.macroGrid}>
              <div style={styles.macroCard}><span style={styles.macroVal}>{totalCal}</span><span style={styles.macroLbl}>Calories</span></div>
              <div style={styles.macroCard}><span style={styles.macroVal}>{totalPro}g</span><span style={styles.macroLbl}>Protein</span></div>
              <div style={styles.macroCard}><span style={styles.macroVal}>{totalCarb}g</span><span style={styles.macroLbl}>Carbs</span></div>
              <div style={styles.macroCard}><span style={styles.macroVal}>{totalFat}g</span><span style={styles.macroLbl}>Fat</span></div>
            </div>

            {/* MEAL LIBRARY MANAGEMENT */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Meal Library</h3>
                <button style={styles.secondaryBtn} onClick={() => setShowAddLib(!showAddLib)}>{showAddLib ? 'Close' : '+ Saved Meal'}</button>
              </div>

              {showAddLib && (
                <form onSubmit={handleSaveToLibrary} style={{ marginTop: '12px' }}>
                  <input type="text" placeholder="Meal Name (e.g. Chicken & Rice)" value={libName} onChange={(e) => setLibName(e.target.value)} style={styles.input} required />
                  <div style={styles.grid2x2}>
                    <input type="number" placeholder="Calories" value={libCal} onChange={(e) => setLibCal(e.target.value)} style={styles.input} />
                    <input type="number" placeholder="Protein (g)" value={libPro} onChange={(e) => setLibPro(e.target.value)} style={styles.input} />
                    <input type="number" placeholder="Carbs (g)" value={libCarb} onChange={(e) => setLibCarb(e.target.value)} style={styles.input} />
                    <input type="number" placeholder="Fat (g)" value={libFat} onChange={(e) => setLibFat(e.target.value)} style={styles.input} />
                  </div>
                  <button type="submit" style={styles.primaryBtn}>Save Meal to Library</button>
                </form>
              )}

              <div style={{ marginTop: '12px' }}>
                {mealLibrary.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '0.85rem' }}>No saved meals yet. Add one above!</p>
                ) : (
                  mealLibrary.map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #2A2A2A' }}>
                      <div>
                        <strong>{m.name}</strong>
                        <div style={{ color: '#888', fontSize: '0.75rem' }}>{m.calories} kcal | P:{m.protein}g C:{m.carbs}g F:{m.fat}g</div>
                      </div>
                      <button style={styles.cancelBtn} onClick={() => deleteLibraryMeal(m.id)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DAILY MEAL SLOTS */}
            <div style={{ margin: '16px 0' }}>
              <h3>Today's Meals</h3>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input type="text" placeholder="Add Slot Name (e.g., Pre-Workout)" value={newSlotName} onChange={(e) => setNewSlotName(e.target.value)} style={{ ...styles.input, marginBottom: 0 }} />
                <button style={styles.secondaryBtn} onClick={handleAddSlot}>+ Slot</button>
              </div>

              {mealSlots.map((slot) => {
                const logsInSlot = nutritionLogs.filter((l) => (l.slot_name || 'Breakfast') === slot);
                return (
                  <div key={slot} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, color: '#00E676' }}>{slot}</h4>
                      <button style={{ ...styles.cancelBtn, fontSize: '0.8rem' }} onClick={() => removeSlot(slot)}>Remove Slot</button>
                    </div>

                    {/* Quick Log Selector */}
                    {mealLibrary.length > 0 && (
                      <select
                        onChange={(e) => {
                          const meal = mealLibrary.find((m) => m.id === e.target.value);
                          if (meal) logMealFromLibrary(slot, meal);
                          e.target.value = '';
                        }}
                        style={{ ...styles.input, backgroundColor: '#1A1A1A' }}
                      >
                        <option value="">+ Add meal from library...</option>
                        {mealLibrary.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.calories} kcal)</option>
                        ))}
                      </select>
                    )}

                    {logsInSlot.length === 0 ? (
                      <p style={{ color: '#666', fontSize: '0.8rem', margin: '4px 0' }}>Empty</p>
                    ) : (
                      logsInSlot.map((item) => (
                        <div key={item.id} style={styles.logItem}>
                          <div>
                            <strong>{item.food_name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#888' }}>
                              {item.calories} kcal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                            </div>
                          </div>
                          <button style={styles.cancelBtn} onClick={() => deleteNutritionLog(item.id)}>✕</button>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <button style={activeTab === 'gym' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('gym')}>🏋️ Gym</button>
        <button style={activeTab === 'nutrition' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('nutrition')}>🥗 Nutrition</button>
      </nav>
    </div>
  );
}

const styles = {
  appContainer: { backgroundColor: '#121212', color: '#E0E0E0', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'sans-serif' },
  header: { padding: '16px', backgroundColor: '#1E1E1E', borderBottom: '1px solid #2C2C2C' },
  title: { margin: 0, fontSize: '1.2rem', color: '#00E676', letterSpacing: '1px' },
  logoutBtn: { backgroundColor: '#2A2A2A', color: '#FF5252', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' },
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
  logItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#252525', borderRadius: '6px', marginTop: '8px' },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#1E1E1E', borderTop: '1px solid #2C2C2C', display: 'flex', justifyContent: 'space-around', alignItems: 'center' },
  navBtn: { background: 'none', border: 'none', color: '#666', fontSize: '1rem', cursor: 'pointer' },
  activeNavBtn: { background: 'none', border: 'none', color: '#00E676', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};