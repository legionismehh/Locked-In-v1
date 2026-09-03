import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Calendar as CalendarIcon, 
  X 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  
  // Active Workout State
  const [activeWorkout, setActiveWorkout] = useState(null);

  // History Calendar State
  const [calendarView, setCalendarView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateLog, setSelectedDateLog] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    // Fetch Templates
    const { data: tData } = await supabase.from('workout_templates').select('*');
    if (tData) setTemplates(tData);

    // Fetch Exercise Library
    const { data: eData } = await supabase.from('exercises').select('name');
    if (eData) setExerciseLibrary(eData.map(e => e.name));

    // Fetch Workout Logs
    const { data: hData } = await supabase.from('workout_logs').select('*').order('completed_at', { ascending: false });
    if (hData) setHistoryLogs(hData);
  };

  // Pre-fill sets from previous performance for a given exercise name
  const getPreviousPerformance = (exerciseName) => {
    for (const log of historyLogs) {
      if (!log.exercises) continue;
      const match = log.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
      if (match && match.sets && match.sets.length > 0) {
        return match.sets.map(s => ({ ...s }));
      }
    }
    return [
      { set_number: 1, weight: '', reps: '' },
      { set_number: 2, weight: '', reps: '' },
      { set_number: 3, weight: '', reps: '' }
    ];
  };

  const startWorkoutFromTemplate = (template) => {
    // Clone template and populate with last logged weight/reps where possible
    const populatedExercises = (template.exercises || []).map(ex => {
      const prevSets = getPreviousPerformance(ex.name);
      return {
        ...ex,
        sets: prevSets.length > 0 ? prevSets : ex.sets
      };
    });

    setActiveWorkout({
      ...template,
      exercises: populatedExercises
    });
  };

  // Handle active workout modifications
  const handleSetChange = (exIndex, setIndex, field, value) => {
    if (!activeWorkout) return;
    const updatedExercises = [...activeWorkout.exercises];
    const val = value === '' ? '' : Number(value);
    updatedExercises[exIndex].sets[setIndex][field] = val;
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const addSetToExercise = (exIndex) => {
    if (!activeWorkout) return;
    const updatedExercises = [...activeWorkout.exercises];
    const currentSets = updatedExercises[exIndex].sets;
    const lastSet = currentSets[currentSets.length - 1] || { weight: '', reps: '' };
    currentSets.push({
      set_number: currentSets.length + 1,
      weight: lastSet.weight,
      reps: lastSet.reps
    });
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const removeSetFromExercise = (exIndex, setIndex) => {
    if (!activeWorkout) return;
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exIndex].sets.splice(setIndex, 1);
    // Renumber
    updatedExercises[exIndex].sets = updatedExercises[exIndex].sets.map((s, idx) => ({ ...s, set_number: idx + 1 }));
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const moveExercise = (index, direction) => {
    if (!activeWorkout) return;
    const newExercises = [...activeWorkout.exercises];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newExercises.length) return;

    const temp = newExercises[index];
    newExercises[index] = newExercises[targetIndex];
    newExercises[targetIndex] = temp;
    setActiveWorkout({ ...activeWorkout, exercises: newExercises });
  };

  const addExerciseToActiveWorkout = (name) => {
    if (!activeWorkout || !name.trim()) return;
    const prevSets = getPreviousPerformance(name);
    setActiveWorkout({
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, { name, sets: prevSets }]
    });
  };

  const finishWorkout = async () => {
    if (!activeWorkout) return;

    const newLog = {
      template_id: activeWorkout.id,
      template_name: activeWorkout.name,
      color: activeWorkout.color || '#22c55e',
      completed_at: new Date().toISOString(),
      exercises: activeWorkout.exercises
    };

    const { data, error } = await supabase.from('workout_logs').insert([newLog]).select();
    if (!error && data) {
      setHistoryLogs([data[0], ...historyLogs]);
      setActiveWorkout(null);
      setActiveTab('history');
    }
  };

  // Calendar Helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 max-w-md mx-auto font-sans pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-wider text-emerald-400">LOCKED IN</h1>
        <button className="text-xs text-neutral-400 hover:text-red-400">Log Out</button>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'templates' ? 'bg-neutral-800 text-emerald-400 shadow' : 'text-neutral-400'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'history' ? 'bg-neutral-800 text-emerald-400 shadow' : 'text-neutral-400'
          }`}
        >
          History
        </button>
      </div>

      {/* Active Workout Tracker Mode */}
      {activeWorkout ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
            <div>
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-semibold">Active Session</span>
              <h2 className="text-xl font-bold">{activeWorkout.name}</h2>
            </div>
            <button 
              onClick={() => setActiveWorkout(null)} 
              className="text-xs bg-red-950 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900"
            >
              Cancel
            </button>
          </div>

          {activeWorkout.exercises.map((ex, exIndex) => (
            <div key={exIndex} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  value={ex.name}
                  onChange={(e) => {
                    const updated = [...activeWorkout.exercises];
                    updated[exIndex].name = e.target.value;
                    setActiveWorkout({ ...activeWorkout, exercises: updated });
                  }}
                  className="bg-transparent font-semibold text-lg text-emerald-400 focus:outline-none focus:border-b border-emerald-500 w-full mr-2"
                />
                <div className="flex items-center space-x-1">
                  <button 
                    onClick={() => moveExercise(exIndex, 'up')}
                    disabled={exIndex === 0}
                    className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => moveExercise(exIndex, 'down')}
                    disabled={exIndex === activeWorkout.exercises.length - 1}
                    className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Set Table */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 text-xs text-neutral-400 font-medium px-1">
                  <span className="col-span-2">SET</span>
                  <span className="col-span-4">LBS</span>
                  <span className="col-span-4">REPS</span>
                  <span className="col-span-2 text-right">ACTION</span>
                </div>

                {ex.sets.map((set, setIndex) => (
                  <div key={setIndex} className="grid grid-cols-12 items-center gap-2">
                    <span className="col-span-2 text-sm text-neutral-400 font-bold px-1">
                      {set.set_number}
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      value={set.weight}
                      onChange={(e) => handleSetChange(exIndex, setIndex, 'weight', e.target.value)}
                      className="col-span-4 bg-neutral-800 rounded-lg px-2 py-1 text-center text-sm font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="0"
                      value={set.reps}
                      onChange={(e) => handleSetChange(exIndex, setIndex, 'reps', e.target.value)}
                      className="col-span-4 bg-neutral-800 rounded-lg px-2 py-1 text-center text-sm font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      onClick={() => removeSetFromExercise(exIndex, setIndex)}
                      className="col-span-2 flex justify-end text-neutral-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addSetToExercise(exIndex)}
                className="w-full py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition"
              >
                + Add Set
              </button>
            </div>
          ))}

          {/* Add Exercise On-the-Fly */}
          <div className="bg-neutral-900 border border-dashed border-neutral-800 rounded-xl p-4 flex flex-col items-center">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addExerciseToActiveWorkout(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full bg-neutral-800 text-sm text-neutral-300 p-2.5 rounded-lg outline-none"
            >
              <option value="">+ Add Exercise to Session...</option>
              {exerciseLibrary.map((exName, i) => (
                <option key={i} value={exName}>{exName}</option>
              ))}
            </select>
          </div>

          <button
            onClick={finishWorkout}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold rounded-xl shadow-lg transition"
          >
            Complete Workout
          </button>
        </div>
      ) : activeTab === 'templates' ? (
        /* TEMPLATES TAB */
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Your Routines</h2>
          <div className="grid gap-3">
            {templates.map((tmpl) => (
              <div 
                key={tmpl.id} 
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 hover:border-neutral-700 transition"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tmpl.color || '#22c55e' }} 
                    />
                    <h3 className="font-bold text-lg">{tmpl.name}</h3>
                  </div>
                  <button 
                    onClick={() => startWorkoutFromTemplate(tmpl)}
                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-500 hover:text-neutral-950 transition"
                  >
                    Start Session
                  </button>
                </div>
                <div className="text-xs text-neutral-400 space-y-1">
                  {(tmpl.exercises || []).map((e, idx) => (
                    <div key={idx}>• {e.name} ({(e.sets || []).length} sets)</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* HISTORY TAB (CALENDAR & VERTICAL SETS) */
        <div className="space-y-6">
          {/* Calendar Header */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <div className="bg-neutral-800 p-0.5 rounded-lg flex text-xs">
                  <button
                    onClick={() => setCalendarView('month')}
                    className={`px-2 py-1 rounded ${calendarView === 'month' ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setCalendarView('week')}
                    className={`px-2 py-1 rounded ${calendarView === 'week' ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
                  >
                    Week
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} 
                  className="p-1 hover:bg-neutral-800 rounded"
                >
                  <ChevronLeft className="w-4 h-4 text-neutral-400" />
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} 
                  className="p-1 hover:bg-neutral-800 rounded"
                >
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
            </div>

            {/* Grid Days */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <span key={i} className="text-xs font-semibold text-neutral-500 py-1">{day}</span>
              ))}

              {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8" />
              ))}

              {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                const dayNum = i + 1;
                const formattedDay = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                
                // Find matching logs on this day
                const logsForDay = historyLogs.filter(log => log.completed_at && log.completed_at.startsWith(formattedDay));
                const hasWorkout = logsForDay.length > 0;
                const workoutColor = hasWorkout ? logsForDay[0].color || '#22c55e' : 'transparent';

                return (
                  <button
                    key={dayNum}
                    onClick={() => hasWorkout && setSelectedDateLog(logsForDay[0])}
                    className={`h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition ${
                      hasWorkout ? 'hover:scale-105' : ''
                    }`}
                    style={{
                      backgroundColor: hasWorkout ? `${workoutColor}20` : 'transparent',
                      color: hasWorkout ? workoutColor : '#a3a3a3',
                      border: hasWorkout ? `1px solid ${workoutColor}` : 'none'
                    }}
                  >
                    <span>{dayNum}</span>
                    {hasWorkout && (
                      <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: workoutColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Workout Log View / Standard History List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
              {selectedDateLog ? 'Selected Day Workout' : 'Recent Workouts'}
            </h3>

            {(selectedDateLog ? [selectedDateLog] : historyLogs).map((log) => (
              <div key={log.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4 relative">
                {selectedDateLog && (
                  <button 
                    onClick={() => setSelectedDateLog(null)} 
                    className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold" style={{ color: log.color || '#22c55e' }}>
                      {log.template_name}
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium mt-0.5">
                      {new Date(log.completed_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Vertical Set Format */}
                <div className="space-y-4 pt-2">
                  {(log.exercises || []).map((ex, exIdx) => (
                    <div key={exIdx} className="space-y-1.5">
                      <h4 className="text-sm font-bold text-neutral-200">{ex.name}</h4>
                      <div className="bg-neutral-950/60 rounded-xl p-2.5 space-y-1">
                        {(ex.sets || []).map((s, sIdx) => (
                          <div key={sIdx} className="text-xs text-neutral-400 flex justify-between px-1">
                            <span className="font-medium text-neutral-500">Set {s.set_number}</span>
                            <span className="font-semibold text-neutral-300">
                              {s.weight ? `${s.weight} lbs` : '0 lbs'} × {s.reps ? `${s.reps} reps` : '0 reps'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}