import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emptySet = () => ({ weight: '', reps: '' });
const emptyExercise = () => ({ name: '', sets: [emptySet()], previousSets: [] });

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [gymSubTab, setGymSubTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [history, setHistory] = useState([]);
  const [editingLog, setEditingLog] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateLog, setSelectedDateLog] = useState(null);

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateExercises, setNewTemplateExercises] = useState(['']);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchTemplates();
      fetchHistory();
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

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTemplates(data);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .order('completed_at', { ascending: false });

    if (data) setHistory(data);
  };

  const normalizeExerciseName = (name = '') => name.trim().toLowerCase();

  const findPreviousExercise = (exerciseName) => {
    const normalized = normalizeExerciseName(exerciseName);
    if (!normalized) return null;

    // history is already sorted newest -> oldest, so the first match is the latest performance.
    for (const log of history) {
      const match = log.exercises?.find(
        (exercise) => normalizeExerciseName(exercise.name) === normalized
      );

      if (match) {
        return {
          sets: match.sets || [],
          completedAt: log.completed_at,
          workoutName: log.template_name,
        };
      }
    }

    return null;
  };

  const buildExerciseFromHistory = (exercise) => {
    const previous = findPreviousExercise(exercise.name);

    if (previous?.sets?.length) {
      return {
        ...exercise,
        sets: previous.sets.map((set) => ({
          weight: set.weight ?? '',
          reps: set.reps ?? '',
        })),
        previousSets: previous.sets.map((set) => ({
          weight: set.weight ?? '',
          reps: set.reps ?? '',
        })),
        previousCompletedAt: previous.completedAt,
        previousWorkoutName: previous.workoutName,
      };
    }

    const templateSetCount = exercise.sets?.length || 1;
    return {
      ...exercise,
      sets: Array.from({ length: templateSetCount }, emptySet),
      previousSets: [],
    };
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;

    const exercisesList = newTemplateExercises
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, sets: [emptySet()] }));

    if (exercisesList.length === 0) return;

    const { data, error } = await supabase
      .from('templates')
      .insert([
        {
          name: newTemplateName.trim(),
          exercises: exercisesList,
          user_id: session.user.id,
        },
      ])
      .select();

    if (!error && data) {
      setTemplates([data[0], ...templates]);
      setNewTemplateName('');
      setNewTemplateExercises(['']);
      setShowNewTemplate(false);
    }
  };

  const startWorkout = (template) => {
    const workout = JSON.parse(JSON.stringify(template));
    workout.exercises = (workout.exercises || []).map(buildExerciseFromHistory);
    setActiveWorkout(workout);
  };

  const startBlankWorkout = () => {
    setActiveWorkout({
      name: 'Freestyle Workout',
      isFreestyle: true,
      exercises: [emptyExercise()],
    });
  };

  const updateWorkoutName = (value) => {
    setActiveWorkout((current) => ({ ...current, name: value }));
  };

  const updateExerciseName = (exIndex, value) => {
    setActiveWorkout((current) => {
      const updated = JSON.parse(JSON.stringify(current));
      updated.exercises[exIndex].name = value;

      const previous = findPreviousExercise(value);
      if (previous?.sets?.length) {
        updated.exercises[exIndex].previousSets = previous.sets.map((set) => ({
          weight: set.weight ?? '',
          reps: set.reps ?? '',
        }));
        updated.exercises[exIndex].previousCompletedAt = previous.completedAt;
        updated.exercises[exIndex].previousWorkoutName = previous.workoutName;
      } else {
        updated.exercises[exIndex].previousSets = [];
        delete updated.exercises[exIndex].previousCompletedAt;
        delete updated.exercises[exIndex].previousWorkoutName;
      }

      return updated;
    });
  };

  const usePreviousForExercise = (exIndex) => {
    setActiveWorkout((current) => {
      const updated = JSON.parse(JSON.stringify(current));
      const exercise = updated.exercises[exIndex];

      if (!exercise.previousSets?.length) return current;

      exercise.sets = exercise.previousSets.map((set) => ({
        weight: set.weight ?? '',
        reps: set.reps ?? '',
      }));
      return updated;
    });
  };

  const updateSet = (exIndex, setIndex, field, value) => {
    setActiveWorkout((current) => {
      const updated = JSON.parse(JSON.stringify(current));
      updated.exercises[exIndex].sets[setIndex][field] = value === '' ? '' : Number(value);
      return updated;
    });
  };

  const addSet = (exIndex) => {
    setActiveWorkout((current) => {
      const updated = JSON.parse(JSON.stringify(current));
      updated.exercises[exIndex].sets.push(emptySet());
      return updated;
    });
  };

  const removeSet = (exIndex, setIndex) => {
    setActiveWorkout((current) => {
      const updated = JSON.parse(JSON.stringify(current));
      updated.exercises[exIndex].sets.splice(setIndex, 1);

      if (updated.exercises[exIndex].sets.length === 0) {
        updated.exercises[exIndex].sets.push(emptySet());
      }

      return updated;
    });
  };

  const addExercise = () => {
    setActiveWorkout((current) => ({
      ...current,
      exercises: [...current.exercises, emptyExercise()],
    }));
  };

  const removeExercise = (exIndex) => {
    setActiveWorkout((current) => {
      const updated = JSON.parse(JSON.stringify(current));
      updated.exercises.splice(exIndex, 1);
      return updated;
    });
  };

  const moveExercise = (index, direction) => {
    setActiveWorkout((current) => {
      if (!current) return current;

      const updated = JSON.parse(JSON.stringify(current));
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.exercises.length) return current;

      [updated.exercises[index], updated.exercises[targetIndex]] = [
        updated.exercises[targetIndex],
        updated.exercises[index],
      ];

      return updated;
    });
  };

  const finishWorkout = async () => {
    if (!activeWorkout) return;

    const cleanedExercises = activeWorkout.exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({
        name: exercise.name.trim(),
        sets: exercise.sets.map((set, setIndex) => ({
          set_number: setIndex + 1,
          weight: set.weight === '' ? 0 : Number(set.weight),
          reps: set.reps === '' ? 0 : Number(set.reps),
        })),
      }));

    if (cleanedExercises.length === 0) {
      alert('Add at least one exercise before finishing your workout.');
      return;
    }

    const workoutName = activeWorkout.name?.trim() || 'Freestyle Workout';

    const { error } = await supabase.from('workout_logs').insert([
      {
        template_name: workoutName,
        exercises: cleanedExercises,
        user_id: session.user.id,
      },
    ]);

    if (!error) {
      setActiveWorkout(null);
      setSelectedDateLog(null);
      await fetchHistory();
      setGymSubTab('history');
    }
  };

  const deleteWorkoutLog = async (id) => {
    if (!window.confirm('Delete this workout log?')) return;
    const { error } = await supabase.from('workout_logs').delete().eq('id', id);
    if (!error) {
      setHistory(history.filter((item) => item.id !== id));
      if (selectedDateLog?.id === id) setSelectedDateLog(null);
    }
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

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  if (!session) {
    return (
      <div style={styles.appContainer}>
        <header style={styles.header}>
          <h1 style={styles.title}>LOCKED IN</h1>
        </header>

        <main style={styles.content}>
          <form onSubmit={handleAuth} style={styles.card}>
            <h3>{isSignUp ? 'Create Account' : 'Welcome Back'}</h3>
            {authError && <p style={{ color: '#FF5252', fontSize: '0.85rem' }}>{authError}</p>}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.primaryBtn}>
              {isSignUp ? 'Sign Up' : 'Log In'}
            </button>
            <p
              style={{ color: '#00E676', textAlign: 'center', cursor: 'pointer', marginTop: '12px', fontSize: '0.9rem' }}
              onClick={() => setIsSignUp(!isSignUp)}
            >
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
        <div>
          <h1 style={styles.title}>LOCKED IN</h1>
          <div style={styles.headerSubtitle}>Workout Tracker</div>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>Log Out</button>
      </header>

      <main style={styles.content}>
        {!activeWorkout && (
          <div style={styles.subTabNav}>
            <button
              style={gymSubTab === 'templates' ? styles.activeSubTab : styles.subTab}
              onClick={() => setGymSubTab('templates')}
            >
              Workouts
            </button>
            <button
              style={gymSubTab === 'history' ? styles.activeSubTab : styles.subTab}
              onClick={() => setGymSubTab('history')}
            >
              History
            </button>
          </div>
        )}

        {activeWorkout ? (
          <div>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={styles.eyebrow}>ACTIVE WORKOUT</div>
                  <input
                    type="text"
                    value={activeWorkout.name || ''}
                    onChange={(e) => updateWorkoutName(e.target.value)}
                    style={styles.workoutTitleInput}
                    aria-label="Workout name"
                  />
                </div>
                <button style={styles.cancelBtn} onClick={() => setActiveWorkout(null)}>Cancel</button>
              </div>

              <p style={styles.mutedText}>
                Your changes only affect this workout. Saved templates stay unchanged.
              </p>
            </div>

            {activeWorkout.exercises.map((exercise, exIdx) => (
              <div key={exIdx} style={styles.exerciseBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <input
                    type="text"
                    value={exercise.name}
                    placeholder="Exercise name"
                    onChange={(e) => updateExerciseName(exIdx, e.target.value)}
                    style={styles.exerciseNameInput}
                  />

                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button style={styles.iconBtn} onClick={() => moveExercise(exIdx, 'up')} disabled={exIdx === 0}>▲</button>
                    <button
                      style={styles.iconBtn}
                      onClick={() => moveExercise(exIdx, 'down')}
                      disabled={exIdx === activeWorkout.exercises.length - 1}
                    >
                      ▼
                    </button>
                    <button style={styles.removeExerciseBtn} onClick={() => removeExercise(exIdx)}>✕</button>
                  </div>
                </div>

                {exercise.previousSets?.length > 0 && (
                  <div style={styles.previousSummary}>
                    <div>
                      <strong>Last time</strong>
                      {exercise.previousCompletedAt && (
                        <span style={styles.previousMeta}>
                          {' '}• {new Date(exercise.previousCompletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <button style={styles.smallBtn} onClick={() => usePreviousForExercise(exIdx)}>
                      Use last sets
                    </button>
                  </div>
                )}

                <div style={styles.setHeaderRow}>
                  <span>SET</span>
                  <span>LAST</span>
                  <span>LBS</span>
                  <span>REPS</span>
                  <span />
                </div>

                {exercise.sets.map((set, setIdx) => {
                  const previousSet = exercise.previousSets?.[setIdx];

                  return (
                    <div key={setIdx} style={styles.setGridRow}>
                      <span style={styles.setNumber}>{setIdx + 1}</span>
                      <span style={styles.previousSetValue}>
                        {previousSet ? `${previousSet.weight ?? '-'} × ${previousSet.reps ?? '-'}` : '—'}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="lbs"
                        value={set.weight}
                        onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                        style={styles.setFormInput}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="reps"
                        value={set.reps}
                        onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                        style={styles.setFormInput}
                      />
                      <button style={styles.iconBtn} onClick={() => removeSet(exIdx, setIdx)}>✕</button>
                    </div>
                  );
                })}

                <button style={styles.secondaryBtnFull} onClick={() => addSet(exIdx)}>+ Add Set</button>
              </div>
            ))}

            <button style={styles.addExerciseBtn} onClick={addExercise}>+ Add Exercise</button>
            <button style={styles.primaryBtn} onClick={finishWorkout}>Finish & Save Workout</button>
          </div>
        ) : gymSubTab === 'templates' ? (
          <div>
            <div style={styles.startActions}>
              <button style={styles.freestyleBtn} onClick={startBlankWorkout}>
                <span style={{ fontSize: '1.2rem' }}>＋</span>
                <span>
                  <strong>Start Empty Workout</strong>
                  <small style={styles.buttonSubtext}>Build it as you go</small>
                </span>
              </button>

              <button style={styles.secondaryBtnFull} onClick={() => setShowNewTemplate(!showNewTemplate)}>
                {showNewTemplate ? 'Close Template Builder' : '+ Create New Template'}
              </button>
            </div>

            {showNewTemplate && (
              <div style={styles.card}>
                <h3 style={{ marginTop: 0 }}>New Template</h3>
                <input
                  type="text"
                  placeholder="Template Name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  style={styles.input}
                />

                <h4>Exercises</h4>
                {newTemplateExercises.map((exercise, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder={`Exercise ${idx + 1}`}
                      value={exercise}
                      onChange={(e) => {
                        const updated = [...newTemplateExercises];
                        updated[idx] = e.target.value;
                        setNewTemplateExercises(updated);
                      }}
                      style={{ ...styles.input, marginBottom: '8px' }}
                    />
                    {newTemplateExercises.length > 1 && (
                      <button
                        style={{ ...styles.cancelBtn, marginBottom: '8px' }}
                        onClick={() => setNewTemplateExercises(newTemplateExercises.filter((_, i) => i !== idx))}
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <button
                  style={styles.secondaryBtnFull}
                  onClick={() => setNewTemplateExercises([...newTemplateExercises, ''])}
                >
                  + Add Exercise
                </button>
                <button style={styles.primaryBtn} onClick={handleSaveTemplate}>Save Template</button>
              </div>
            )}

            <h3 style={{ margin: '20px 0 10px' }}>Saved Templates</h3>
            {templates.length === 0 ? (
              <div style={styles.emptyState}>
                No templates yet. Start an empty workout or create your first template.
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} style={styles.card}>
                  <h3 style={{ margin: '0 0 8px' }}>{template.name}</h3>
                  <p style={styles.mutedText}>
                    {template.exercises?.length
                      ? template.exercises.map((exercise) => exercise.name).join(', ')
                      : 'No exercises'}
                  </p>
                  <button style={styles.startBtn} onClick={() => startWorkout(template)}>
                    Start Workout
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>
                  📅 {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={styles.secondaryBtn}
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  >
                    ◀
                  </button>
                  <button
                    style={styles.secondaryBtn}
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div style={styles.calendarGrid}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {day}
                  </div>
                ))}

                {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                  const dayNum = i + 1;
                  const formattedDay = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const logsForDay = history.filter(
                    (log) => log.completed_at && log.completed_at.startsWith(formattedDay)
                  );
                  const hasWorkout = logsForDay.length > 0;

                  return (
                    <button
                      key={dayNum}
                      onClick={() => hasWorkout && setSelectedDateLog(logsForDay[0])}
                      style={{
                        ...styles.calendarDay,
                        backgroundColor: hasWorkout ? '#00E67620' : 'transparent',
                        border: hasWorkout ? '1px solid #00E676' : '1px solid transparent',
                        color: hasWorkout ? '#00E676' : '#AAA',
                        cursor: hasWorkout ? 'pointer' : 'default',
                      }}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {editingLog && (
              <div style={{ ...styles.card, borderColor: '#00E676' }}>
                <h3 style={{ color: '#00E676' }}>Editing: {editingLog.template_name}</h3>
                {editingLog.exercises.map((exercise, exIdx) => (
                  <div key={exIdx} style={styles.exerciseBox}>
                    <h4 style={{ margin: '0 0 8px', color: '#FFF' }}>{exercise.name}</h4>
                    {exercise.sets.map((set, setIdx) => (
                      <div key={setIdx} style={styles.editSetRow}>
                        <span style={{ color: '#888' }}>#{setIdx + 1}</span>
                        <input
                          type="number"
                          value={set.weight}
                          onChange={(e) => {
                            const updated = JSON.parse(JSON.stringify(editingLog));
                            updated.exercises[exIdx].sets[setIdx].weight = Number(e.target.value);
                            setEditingLog(updated);
                          }}
                          style={styles.setFormInput}
                        />
                        <span style={{ color: '#888' }}>lbs</span>
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => {
                            const updated = JSON.parse(JSON.stringify(editingLog));
                            updated.exercises[exIdx].sets[setIdx].reps = Number(e.target.value);
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
                  <button style={styles.secondaryBtnFull} onClick={() => setEditingLog(null)}>Cancel</button>
                </div>
              </div>
            )}

            {(selectedDateLog ? [selectedDateLog] : history).map((log) => (
              <div key={log.id} style={styles.card}>
                {selectedDateLog && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-20px' }}>
                    <button style={styles.cancelBtn} onClick={() => setSelectedDateLog(null)}>✕</button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', alignItems: 'center' }}>
                  <strong style={{ color: '#00E676', fontSize: '1.15rem' }}>{log.template_name}</strong>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      style={{ ...styles.secondaryBtn, padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                      onClick={() => setEditingLog(JSON.parse(JSON.stringify(log)))}
                    >
                      Edit
                    </button>
                    <button style={{ ...styles.cancelBtn, fontSize: '0.85rem' }} onClick={() => deleteWorkoutLog(log.id)}>✕</button>
                  </div>
                </div>

                <span style={{ color: '#666', fontSize: '0.75rem', display: 'block', marginBottom: '16px' }}>
                  {new Date(log.completed_at).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>

                {log.exercises?.map((exercise, idx) => (
                  <div key={idx} style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.95rem', color: '#FFF', fontWeight: 'bold', marginBottom: '6px' }}>
                      {exercise.name}
                    </div>
                    <div style={{ backgroundColor: '#181818', padding: '8px 10px', borderRadius: '8px' }}>
                      {exercise.sets?.map((set, setIdx) => (
                        <div
                          key={setIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                            padding: '5px 0',
                            borderBottom: setIdx !== exercise.sets.length - 1 ? '1px solid #252525' : 'none',
                          }}
                        >
                          <span style={{ color: '#888' }}>Set {set.set_number || setIdx + 1}</span>
                          <span style={{ color: '#DDD', fontWeight: 'bold' }}>{set.weight} lbs × {set.reps} reps</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {history.length === 0 && (
              <div style={styles.emptyState}>Finish your first workout and it will show up here.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  appContainer: {
    backgroundColor: '#121212',
    color: '#E0E0E0',
    minHeight: '100vh',
    paddingBottom: '32px',
    fontFamily: 'sans-serif',
  },
  header: {
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderBottom: '1px solid #2C2C2C',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  title: { margin: 0, fontSize: '1.2rem', color: '#00E676', letterSpacing: '1px' },
  headerSubtitle: { color: '#777', fontSize: '0.72rem', marginTop: '2px' },
  logoutBtn: {
    backgroundColor: '#2A2A2A',
    color: '#FF5252',
    border: 'none',
    padding: '7px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  content: { padding: '16px', maxWidth: '560px', margin: '0 auto' },
  subTabNav: { display: 'flex', gap: '8px', marginBottom: '16px' },
  subTab: {
    flex: 1,
    padding: '10px',
    background: '#1E1E1E',
    border: '1px solid #2A2A2A',
    color: '#888',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  activeSubTab: {
    flex: 1,
    padding: '10px',
    background: '#203026',
    border: '1px solid #00E67655',
    color: '#00E676',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid #2A2A2A',
  },
  input: {
    width: '100%',
    padding: '11px',
    marginBottom: '10px',
    backgroundColor: '#2A2A2A',
    border: '1px solid #3A3A3A',
    color: '#FFF',
    borderRadius: '7px',
    boxSizing: 'border-box',
  },
  workoutTitleInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#00E676',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    outline: 'none',
    padding: '4px 0',
  },
  exerciseNameInput: {
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #444',
    color: '#FFF',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    outline: 'none',
    padding: '5px 0',
  },
  primaryBtn: {
    width: '100%',
    padding: '13px',
    backgroundColor: '#00E676',
    color: '#000',
    border: 'none',
    borderRadius: '9px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px',
  },
  secondaryBtn: {
    padding: '8px 12px',
    backgroundColor: '#2A2A2A',
    color: '#FFF',
    border: '1px solid #444',
    borderRadius: '7px',
    cursor: 'pointer',
  },
  secondaryBtnFull: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#2A2A2A',
    color: '#FFF',
    border: '1px solid #444',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  startBtn: {
    width: '100%',
    padding: '11px',
    backgroundColor: '#2979FF',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  freestyleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px',
    backgroundColor: '#203026',
    color: '#00E676',
    border: '1px solid #00E67666',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  buttonSubtext: { display: 'block', color: '#8BA393', fontWeight: 'normal', marginTop: '2px' },
  startActions: { marginBottom: '18px' },
  cancelBtn: {
    backgroundColor: 'transparent',
    color: '#FF5252',
    border: 'none',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  removeExerciseBtn: {
    background: 'none',
    border: 'none',
    color: '#FF5252',
    cursor: 'pointer',
    padding: '4px 6px',
    fontSize: '1rem',
  },
  exerciseBox: {
    backgroundColor: '#1E1E1E',
    padding: '14px',
    borderRadius: '12px',
    marginBottom: '14px',
    border: '1px solid #303030',
  },
  previousSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    margin: '12px 0 8px',
    padding: '8px 10px',
    borderRadius: '8px',
    backgroundColor: '#17251C',
    color: '#B9EFCB',
    fontSize: '0.78rem',
  },
  previousMeta: { color: '#779381', fontWeight: 'normal' },
  smallBtn: {
    border: '1px solid #00E67655',
    background: '#21382A',
    color: '#00E676',
    borderRadius: '6px',
    padding: '5px 7px',
    fontSize: '0.7rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  setHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(64px, 1fr) 72px 72px 28px',
    gap: '6px',
    alignItems: 'center',
    color: '#666',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    margin: '12px 0 5px',
    textAlign: 'center',
  },
  setGridRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(64px, 1fr) 72px 72px 28px',
    gap: '6px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  setNumber: { color: '#888', fontSize: '0.8rem', textAlign: 'center' },
  previousSetValue: {
    color: '#8FA798',
    fontSize: '0.76rem',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  setFormInput: {
    width: '100%',
    minWidth: 0,
    padding: '8px 4px',
    backgroundColor: '#151515',
    border: '1px solid #444',
    color: '#FFF',
    borderRadius: '6px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  editSetRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px',
  },
  addExerciseBtn: {
    width: '100%',
    padding: '12px',
    background: 'transparent',
    color: '#00E676',
    border: '1px dashed #00E67677',
    borderRadius: '9px',
    cursor: 'pointer',
    marginBottom: '4px',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginTop: '12px',
  },
  calendarDay: {
    padding: '7px 4px',
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '0.85rem',
  },
  eyebrow: { color: '#777', fontSize: '0.66rem', fontWeight: 'bold', letterSpacing: '0.08em' },
  mutedText: { color: '#888', fontSize: '0.84rem', margin: '8px 0 12px', lineHeight: 1.4 },
  emptyState: {
    color: '#777',
    padding: '20px',
    border: '1px dashed #333',
    borderRadius: '10px',
    textAlign: 'center',
    fontSize: '0.85rem',
  },
};
