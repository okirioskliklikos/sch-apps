/*
 * Εφαρμογές σχολείου — Τμήματα στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.02
 * Όνομα κατά την εγκατάσταση: _host_classes.js
 *
 * Κώδικας μόνο του host για τα Τμήματα Γενικής Παιδείας (classesByYear). Το φορτώνει το index.html μετά το
 * _data.js και πριν από το δικό του script: <script src="_host_classes.js"></script>. Δεν το φορτώνουν
 * οι υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostClasses:
 *   APP                                     το αρχείο της εφαρμογής (school_classes.html)
 *   LIMITS                                  όρια πλήθους ({classes, warnRatio})
 *   yearClasses(data, year)                 τα τμήματα ενός έτους ([{id, name, …}])
 *   previousYears(data, year)               τα παλαιότερα έτη με τμήματα: [{year, classes:[όνομα…]}], νεότερο πρώτο
 *   classUsage(data, year)                  σε ποια προγράμματα του έτους εμφανίζεται κάθε τμήμα (με το όνομα)
 *   studentCounts(data, year)               πόσοι μαθητές του έτους (studentsByYear) είναι σε κάθε τμήμα (με το id)
 *   context(data, revision)                 το school-classes:context
 *   validateClasses(classes)                έλεγχος της λίστας ενός έτους· επιστρέφει καθαρό αντίγραφο (πετά λάθος)
 *   fetFile(year, message, rememberedFile)  το αρχείο FET της εισαγωγής (school-classes:fet)
 *   applySave(data, message)                εφαρμογή ενός school-classes:save σε αντίγραφο του data· απορρίπτει
 *                                           την αφαίρεση τμήματος που έχει μαθητές
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-classes:*)
 *
 * Στο .data:
 *   classesByYear[year] = {classes:[{id, name}]}
 *   Αντικείμενο και όχι σκέτη λίστα, ώστε να προστεθούν αργότερα και άλλα είδη τμημάτων. Το name είναι πάντα
 *   στην κανονική γραφή τμήματος («Στ1», SchoolTimetable.classSpelling). Τα άγνωστα πεδία (του έτους και κάθε
 *   τμήματος) διατηρούνται.
 * Τα προγράμματα κρατούν τα τμήματα με το όνομά τους, όχι με το id: μια μετονομασία ή αφαίρεση τμήματος εδώ
 * δεν αλλάζει τα προγράμματα. Γι' αυτό το context λέει σε ποια προγράμματα εμφανίζεται κάθε όνομα (classUsage),
 * ώστε η εφαρμογή να προειδοποιεί.
 * Οι μαθητές (studentsByYear, _host_students.js) κρατούν το id του τμήματος: η μετονομασία περνά σε αυτούς, ενώ
 * ένα τμήμα με μαθητές δεν αφαιρείται (πρώτα μεταφέρονται οι μαθητές του από την εφαρμογή «Μαθητές»).
 */
(() => {
  'use strict';
  const T = window.SchoolTimetable;
  if (!T) throw Error('Το _host_classes.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  const APP = 'school_classes.html';
  // Όριο πλήθους: πιάνει λάθη εφαρμογών, όχι πραγματικά δεδομένα. Πάνω από το όριο η αποθήκευση απορρίπτεται·
  // από το 90% (warnRatio) η εφαρμογή δείχνει προειδοποίηση.
  const LIMITS = Object.freeze({classes: 50, warnRatio: 0.9});
  const MAX_ID = 200, MAX_NAME = 20;

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const quoted = value => '«' + value + '»';
  const startYear = year => Number(String(year).slice(0, 4));

  // ---- Δεδομένα ----
  // Τα τμήματα ενός έτους, ή κενή λίστα. Δεν αλλάζει το data.
  function yearClasses(data, year) {
    const value = isObject(data?.classesByYear) ? data.classesByYear[year] : null;
    return Array.isArray(value?.classes) ? value.classes.filter(isObject) : [];
  }
  // Τα παλαιότερα έτη που έχουν τμήματα, για την «Εισαγωγή από παλαιότερο σχολικό έτος».
  function previousYears(data, year) {
    const byYear = isObject(data?.classesByYear) ? data.classesByYear : {};
    return Object.keys(byYear)
      .filter(other => /^\d{4}-\d{4}$/.test(other) && startYear(other) < startYear(year))
      .map(other => ({year: other, classes: yearClasses(data, other).map(item => String(item.name || '')).filter(Boolean)}))
      .filter(item => item.classes.length)
      .sort((a, b) => startYear(b.year) - startYear(a.year));
  }
  // Σε ποια προγράμματα (και προσχέδια) του έτους εμφανίζεται κάθε τμήμα, από τα classes των δραστηριοτήτων:
  // {[όνομα στην κανονική γραφή]: [{programId, kind, kindLabel, name, periodId, periodName, activities}]}.
  function classUsage(data, year) {
    const value = isObject(data?.timetablesByYear) ? data.timetablesByYear[year] : null;
    const periods = Array.isArray(value?.periods) ? value.periods : [], programs = Array.isArray(value?.programs) ? value.programs : [];
    const periodName = id => periods.find(period => period?.id === id)?.name || '';
    const kindLabel = kind => T.kinds[kind]?.label || kind;
    const usage = {};
    for (const program of programs) {
      if (!isObject(program) || !Array.isArray(program.activities)) continue;
      const counts = new Map();
      for (const activity of program.activities) {
        const names = new Set((Array.isArray(activity?.classes) ? activity.classes : []).map(name => T.classSpelling(name)).filter(Boolean));
        for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
      }
      for (const [name, activities] of counts) (usage[name] ||= []).push({programId: program.id, kind: program.kind, kindLabel: kindLabel(program.kind), name: program.name || '', periodId: program.periodId ?? null, periodName: periodName(program.periodId), activities});
    }
    return usage;
  }

  // Πόσοι μαθητές του έτους είναι σε κάθε τμήμα: {[id τμήματος]: πλήθος}.
  function studentCounts(data, year) {
    const value = isObject(data?.studentsByYear) ? data.studentsByYear[year] : null, counts = {};
    for (const student of Array.isArray(value?.students) ? value.students : []) {
      if (isObject(student) && typeof student.classId === 'string') counts[student.classId] = (counts[student.classId] || 0) + 1;
    }
    return counts;
  }

  // school-classes:context: τα τμήματα του έτους, το Προσωπικό (για τον υπεύθυνο κάθε τμήματος), τα
  // παλαιότερα έτη, η χρήση στα προγράμματα και τα όρια.
  function context(data, revision) {
    const year = data.school.year;
    return clone({
      revision, school: {...data.school}, year,
      classes: yearClasses(data, year),
      staff: Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year] : [],
      previousYears: previousYears(data, year),
      classUsage: classUsage(data, year),
      studentCounts: studentCounts(data, year),
      limits: {classes: LIMITS.classes, warnRatio: LIMITS.warnRatio}
    });
  }

  // ---- Έλεγχοι ----
  // Η λίστα τμημάτων ενός έτους. Απορρίπτει ό,τι θα χαλούσε τα δεδομένα· επιστρέφει καθαρό αντίγραφο με τα
  // άγνωστα πεδία κάθε τμήματος.
  function validateClasses(classes) {
    const newer = ' Βεβαιώσου ότι το school_classes.html είναι η τελευταία έκδοση.';
    if (!Array.isArray(classes)) throw Error('Μη έγκυρη λίστα τμημάτων.' + newer);
    if (classes.length > LIMITS.classes) throw Error('Τα Τμήματα θα είχαν ' + classes.length + ' τμήματα, πάνω από το όριο των ' + LIMITS.classes + ' ανά σχολικό έτος. Η αποθήκευση δεν έγινε· αφαίρεσε όσα δεν χρειάζονται.');
    const ids = new Set(), names = new Map(), out = [];
    for (const item of classes) {
      if (!isObject(item)) throw Error('Μη έγκυρη εγγραφή τμήματος.' + newer);
      if (typeof item.id !== 'string' || !item.id || item.id.length > MAX_ID) throw Error('Μη έγκυρη ταυτότητα τμήματος.' + newer);
      if (ids.has(item.id)) throw Error('Βρέθηκαν διπλές ταυτότητες τμημάτων.' + newer);
      ids.add(item.id);
      if (typeof item.name !== 'string' || !item.name.trim()) throw Error('Το όνομα τμήματος είναι υποχρεωτικό.');
      if (item.name.length > MAX_NAME || T.classSpelling(item.name) !== item.name) throw Error('Το ' + quoted(item.name.slice(0, MAX_NAME)) + ' δεν είναι τμήμα στην κανονική γραφή (τάξη και αριθμός, π.χ. «Α1», «Στ2»).');
      if (names.has(item.name)) throw Error('Το τμήμα ' + quoted(item.name) + ' υπάρχει δύο φορές.');
      names.set(item.name, item.id);
      out.push(clone(item));
    }
    return out;
  }
  // Το school-classes:save σε αντίγραφο του data: αντικαθιστά μόνο τη λίστα του classesByYear[year]. Τα άλλα έτη
  // και τα άγνωστα πεδία του έτους μένουν όπως είναι.
  function applySave(data, message) {
    const year = data.school.year, classes = validateClasses(message?.classes), candidate = clone(data);
    // A class with students cannot be removed: the students would be left without a class.
    const kept = new Set(classes.map(item => item.id)), counts = studentCounts(data, year);
    const lost = yearClasses(data, year).filter(item => !kept.has(item.id) && counts[item.id]);
    if (lost.length) throw Error(lost.map(item => quoted(item.name) + ' (' + counts[item.id] + (counts[item.id] === 1 ? ' μαθητής' : ' μαθητές') + ')').join(', ') + (lost.length === 1 ? ': το τμήμα έχει' : ': τα τμήματα έχουν') + ' μαθητές και δεν αφαιρείται. Μετάφερε πρώτα τους μαθητές σε άλλο τμήμα από τους «Μαθητές».');
    if (!isObject(candidate.classesByYear)) candidate.classesByYear = {};
    const previous = isObject(candidate.classesByYear[year]) ? candidate.classesByYear[year] : {};
    candidate.classesByYear[year] = {...previous, classes};
    return candidate;
  }

  // ---- Αρχείο FET ----
  // Η εφαρμογή διαβάζει τα Groups ενός .fet μέσω του host (school-classes:fet), γιατί τα file handles δεν περνούν
  // από το iframe σε file://. Το τελευταίο αρχείο το θυμάται ανά σχολικό έτος, χωριστά από το Προσωπικό.
  //   message: {action:'last'|'read'|'choose'}
  //   last → {name} ή null· read → {name, text} του τελευταίου (ζητά άδεια ανάγνωσης) ή null· choose → {name, text}
  // rememberedFile: η κοινή συνάρτηση των αρχείων του host (SchoolHostTimetables.rememberedFile).
  const FILE_ACTIONS = ['last', 'read', 'choose'];
  function fetFile(year, message, rememberedFile) {
    if (!FILE_ACTIONS.includes(message?.action)) throw Error('Άγνωστη ενέργεια αρχείου FET. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    if (typeof rememberedFile !== 'function') throw Error('Λείπει το αρχείο _host_timetables.js από τον φάκελο των εφαρμογών. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    return rememberedFile(message.action, {key: 'classes-fet:' + year, pickerId: 'school-classes-fet', description: 'Αρχείο FET', accept: {'application/xml': ['.fet']}});
  }

  // ---- Σύνδεση με το index ----
  // bridge: {
  //   frame                  το iframe των υποεφαρμογών,
  //   acceptOrigin(event)    true όταν το origin του μηνύματος γίνεται δεκτό,
  //   targetOrigin           το origin των απαντήσεων ('*' σε file://),
  //   state()                → {data, revision, app, locked, busy} του index τη στιγμή της κλήσης,
  //   save(candidate)        Promise: γράφει το νέο data στο κοινό αρχείο και το κάνει τρέχον,
  //   activity()             μηδενίζει το ρολόι αδράνειας,
  //   menu()                 ανοίγει την αριστερή μπάρα (school-app:open-menu),
  //   dirty(value)           μη αποθηκευμένες αλλαγές της εφαρμογής,
  //   rememberedFile         η κοινή συνάρτηση των αρχείων του host (SchoolHostTimetables.rememberedFile)
  // }
  function install(bridge) {
    window.addEventListener('message', async event => {
      const message = event.data;
      if (event.source !== bridge.frame.contentWindow || !bridge.acceptOrigin(event)) return;
      if (!isObject(message) || typeof message.type !== 'string') return;
      const state = bridge.state();
      if (state.locked || state.app !== APP) return;
      const source = event.source;
      const reply = payload => { const now = bridge.state(); if (now.app === APP && source === bridge.frame.contentWindow) source.postMessage(payload, bridge.targetOrigin); };
      if (message.type === 'school-app:open-menu') { bridge.activity?.(); bridge.menu?.(); return; }
      if (!message.type.startsWith('school-classes:')) return;
      if (message.type === 'school-classes:dirty') { bridge.dirty?.(!!message.dirty); return; }
      if (message.type === 'school-classes:ready') {
        if (state.data) reply({type: 'school-classes:context', context: context(state.data, state.revision)});
        return;
      }
      if (message.type === 'school-classes:fet' && typeof message.requestId === 'string') {
        // Ack at once: the application then waits without a time limit while a picker is open.
        reply({type: 'school-classes:fet-ack', requestId: message.requestId});
        try {
          if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
          const result = await fetFile(state.data.school.year, message, bridge.rememberedFile);
          reply({type: 'school-classes:fet-result', requestId: message.requestId, ok: true, result});
        } catch (error) {
          reply({type: 'school-classes:fet-result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η επιλογή ακυρώθηκε.' : (error?.message || String(error))});
        }
        return;
      }
      if (message.type !== 'school-classes:save' || typeof message.requestId !== 'string') return;
      bridge.activity?.();
      try {
        if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
        if (state.busy) throw Error('Μια αποθήκευση βρίσκεται ήδη σε εξέλιξη.');
        if (message.revision !== state.revision || message.year !== state.data.school.year) throw Error('Το κοινό αρχείο άλλαξε. Φόρτωσε ξανά τα στοιχεία της εφαρμογής.');
        const candidate = applySave(state.data, message);
        await bridge.save(candidate);
        const now = bridge.state();
        reply({type: 'school-classes:result', requestId: message.requestId, ok: true, context: context(now.data, now.revision)});
      } catch (error) {
        reply({type: 'school-classes:result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η αποθήκευση ακυρώθηκε. Οι αλλαγές παραμένουν στη σελίδα.' : (error?.message || String(error))});
      }
    });
  }

  window.SchoolHostClasses = Object.freeze({
    APP, LIMITS, yearClasses, previousYears, classUsage, studentCounts, context, validateClasses, applySave, fetFile, install
  });
})();
