/*
 * Εφαρμογές σχολείου — Μαθητές στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.01
 * Όνομα κατά την εγκατάσταση: _host_students.js
 *
 * Κώδικας μόνο του host για τους μαθητές (studentsByYear). Το φορτώνει το index.html μετά το _data.js και το
 * _host_classes.js και πριν από το δικό του script: <script src="_host_students.js"></script>. Δεν το
 * φορτώνουν οι υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostStudents:
 *   APP                                     το αρχείο της εφαρμογής (school_students.html)
 *   LIMITS                                  όρια πλήθους ({students, warnRatio})
 *   yearStudents(data, year)                οι μαθητές ενός έτους ([{id, …}])
 *   previousYears(data, year)               τα παλαιότερα έτη με μαθητές: [{year, classes:[{id, name}], students}],
 *                                           νεότερο πρώτο
 *   context(data, revision)                 το school-students:context
 *   validateStudents(students, classIds)    έλεγχος της λίστας ενός έτους· επιστρέφει καθαρό αντίγραφο (πετά λάθος)
 *   applySave(data, message)                εφαρμογή ενός school-students:save σε αντίγραφο του data
 *   csvFile(year, message, rememberedFile)  το CSV μαθητών της εισαγωγής (school-students:file)
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-students:*)
 *
 * Στο .data:
 *   studentsByYear[year] = {students:[{id, registryNumber, lastName, firstName, fatherName, classId, adymDate}]}
 *   Αντικείμενο και όχι σκέτη λίστα, όπως το classesByYear. Το classId είναι το id ενός τμήματος του
 *   classesByYear[year]. Το adymDate είναι 'YYYY-MM-DD' ή ''· η κατάσταση του ΑΔΥΜ υπολογίζεται
 *   (SchoolStudents.adymStatus) και δεν αποθηκεύεται. Τα άγνωστα πεδία (του έτους και κάθε μαθητή) διατηρούνται.
 *   Ένας μαθητής κρατά το ίδιο id σε όλα τα σχολικά έτη. Οι άλλες εφαρμογές αναφέρονται σε αυτόν με studentId.
 *   Ο Αριθμός Μητρώου δεν είναι μοναδικός και δεν ελέγχεται εδώ για διπλές τιμές.
 * Η αποθήκευση μπορεί να φέρει και νέα τμήματα (newClasses), π.χ. από την εισαγωγή CSV ή από παλαιότερο έτος:
 * προστίθενται στο classesByYear[year] στην ίδια αποθήκευση, με τους ελέγχους του _host_classes.js. Η εφαρμογή
 * δεν αλλάζει ούτε αφαιρεί τμήματα.
 */
(() => {
  'use strict';
  const T = window.SchoolTimetable, D = window.SchoolDate, Classes = window.SchoolHostClasses;
  if (!T || !D || !Classes) throw Error('Το _host_students.js χρειάζεται το _data.js και το _host_classes.js, φορτωμένα πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  const APP = 'school_students.html';
  // Όριο πλήθους: πιάνει λάθη εφαρμογών, όχι πραγματικά δεδομένα. Πάνω από το όριο η αποθήκευση απορρίπτεται·
  // από το 90% (warnRatio) η εφαρμογή δείχνει προειδοποίηση.
  const LIMITS = Object.freeze({students: 1000, warnRatio: 0.9});
  const MAX_ID = 200, MAX_TEXT = 100, MAX_REGISTRY = 30;

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const startYear = year => Number(String(year).slice(0, 4));

  // ---- Δεδομένα ----
  function yearStudents(data, year) {
    const value = isObject(data?.studentsByYear) ? data.studentsByYear[year] : null;
    return Array.isArray(value?.students) ? value.students.filter(isObject) : [];
  }
  // Τα παλαιότερα έτη που έχουν μαθητές, με τα τμήματά τους, για τις εισαγωγές από παλαιότερο έτος.
  function previousYears(data, year) {
    const byYear = isObject(data?.studentsByYear) ? data.studentsByYear : {};
    return Object.keys(byYear)
      .filter(other => /^\d{4}-\d{4}$/.test(other) && startYear(other) < startYear(year))
      .map(other => ({year: other, classes: Classes.yearClasses(data, other).map(item => ({id: item.id, name: item.name})), students: yearStudents(data, other)}))
      .filter(item => item.students.length)
      .sort((a, b) => startYear(b.year) - startYear(a.year));
  }

  // school-students:context: οι μαθητές και τα τμήματα του έτους, τα παλαιότερα έτη και τα όρια.
  function context(data, revision) {
    const year = data.school.year;
    return clone({
      revision, school: {...data.school}, year,
      students: yearStudents(data, year),
      classes: Classes.yearClasses(data, year),
      previousYears: previousYears(data, year),
      limits: {students: LIMITS.students, classes: Classes.LIMITS.classes, warnRatio: LIMITS.warnRatio}
    });
  }

  // ---- Έλεγχοι ----
  // Η λίστα μαθητών ενός έτους. Απορρίπτει ό,τι θα χαλούσε τα δεδομένα· επιστρέφει καθαρό αντίγραφο με τα
  // άγνωστα πεδία κάθε μαθητή. classIds: τα id των τμημάτων του έτους (μαζί με τα νέα της αποθήκευσης).
  function validateStudents(students, classIds) {
    const newer = ' Βεβαιώσου ότι το school_students.html είναι η τελευταία έκδοση.';
    if (!Array.isArray(students)) throw Error('Μη έγκυρη λίστα μαθητών.' + newer);
    if (students.length > LIMITS.students) throw Error('Οι Μαθητές θα ήταν ' + students.length + ', πάνω από το όριο των ' + LIMITS.students + ' ανά σχολικό έτος. Η αποθήκευση δεν έγινε· αφαίρεσε όσους δεν χρειάζονται.');
    const ids = new Set(), out = [];
    const text = (value, max) => typeof value === 'string' && value.length <= max;
    for (const item of students) {
      if (!isObject(item)) throw Error('Μη έγκυρη εγγραφή μαθητή.' + newer);
      if (typeof item.id !== 'string' || !item.id || item.id.length > MAX_ID) throw Error('Μη έγκυρη ταυτότητα μαθητή.' + newer);
      if (ids.has(item.id)) throw Error('Βρέθηκαν διπλές ταυτότητες μαθητών.' + newer);
      ids.add(item.id);
      const who = (text(item.lastName, MAX_TEXT) ? item.lastName : '') + ' ' + (text(item.firstName, MAX_TEXT) ? item.firstName : '');
      if (!text(item.lastName, MAX_TEXT) || !item.lastName.trim() || !text(item.firstName, MAX_TEXT) || !item.firstName.trim()) throw Error('Το επώνυμο και το όνομα του μαθητή είναι υποχρεωτικά (έως ' + MAX_TEXT + ' χαρακτήρες).');
      if (!text(item.registryNumber, MAX_REGISTRY)) throw Error('Μη έγκυρος Αριθμός Μητρώου του/της «' + who.trim() + '».');
      if (item.fatherName !== undefined && !text(item.fatherName, MAX_TEXT)) throw Error('Μη έγκυρο όνομα πατέρα του/της «' + who.trim() + '».');
      if (typeof item.classId !== 'string' || !classIds.has(item.classId)) throw Error('Ο/Η «' + who.trim() + '» δεν έχει τμήμα της λίστας «Τμήματα» του σχολικού έτους.' + newer);
      if (item.adymDate !== undefined && item.adymDate !== '' && !D.valid(item.adymDate)) throw Error('Μη έγκυρη ημερομηνία ΑΔΥΜ του/της «' + who.trim() + '».');
      out.push(clone(item));
    }
    return out;
  }
  // Το school-students:save σε αντίγραφο του data: αντικαθιστά τη λίστα του studentsByYear[year] και προσθέτει τα
  // νέα τμήματα (newClasses) στο classesByYear[year]. Τα άλλα έτη και τα άγνωστα πεδία του έτους μένουν.
  function applySave(data, message) {
    const year = data.school.year, candidate = clone(data);
    const existing = Classes.yearClasses(data, year), added = message?.newClasses ?? [];
    if (!Array.isArray(added)) throw Error('Μη έγκυρη λίστα νέων τμημάτων. Βεβαιώσου ότι το school_students.html είναι η τελευταία έκδοση.');
    const known = new Set(existing.map(item => item.id));
    if (added.some(item => !isObject(item) || known.has(item.id))) throw Error('Οι Μαθητές μπορούν μόνο να προσθέσουν τμήματα, όχι να αλλάξουν υπάρχοντα. Βεβαιώσου ότι το school_students.html είναι η τελευταία έκδοση.');
    const classes = added.length ? Classes.validateClasses([...existing, ...added]) : existing;
    const students = validateStudents(message?.students, new Set(classes.map(item => item.id)));
    if (added.length) {
      if (!isObject(candidate.classesByYear)) candidate.classesByYear = {};
      const previous = isObject(candidate.classesByYear[year]) ? candidate.classesByYear[year] : {};
      candidate.classesByYear[year] = {...previous, classes};
    }
    if (!isObject(candidate.studentsByYear)) candidate.studentsByYear = {};
    const previous = isObject(candidate.studentsByYear[year]) ? candidate.studentsByYear[year] : {};
    candidate.studentsByYear[year] = {...previous, students};
    return candidate;
  }

  // ---- Αρχείο CSV ----
  // Η εφαρμογή διαβάζει το CSV μαθητών μέσω του host (school-students:file), γιατί τα file handles δεν περνούν
  // από το iframe σε file://. Το τελευταίο αρχείο το θυμάται ανά σχολικό έτος. Το CSV του myschool είναι
  // Windows-1253· το διαβάζει σωστά το encoding:'auto' του rememberedFile.
  //   message: {action:'last'|'read'|'choose'}
  //   last → {name} ή null· read → {name, text} του τελευταίου (ζητά άδεια ανάγνωσης) ή null· choose → {name, text}
  const FILE_ACTIONS = ['last', 'read', 'choose'];
  function csvFile(year, message, rememberedFile) {
    if (!FILE_ACTIONS.includes(message?.action)) throw Error('Άγνωστη ενέργεια αρχείου μαθητών. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    if (typeof rememberedFile !== 'function') throw Error('Λείπει το αρχείο _host_timetables.js από τον φάκελο των εφαρμογών. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    return rememberedFile(message.action, {key: 'students-csv:' + year, pickerId: 'school-students-csv', description: 'CSV μαθητών', accept: {'text/csv': ['.csv']}, encoding: 'auto'});
  }

  // ---- Σύνδεση με το index ----
  // bridge: {frame, acceptOrigin(event), targetOrigin, state() → {data, revision, app, locked, busy},
  //          save(candidate), activity(), menu(), dirty(value), rememberedFile}
  // (όπως το SchoolHostClasses.install).
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
      if (!message.type.startsWith('school-students:')) return;
      if (message.type === 'school-students:dirty') { bridge.dirty?.(!!message.dirty); return; }
      if (message.type === 'school-students:ready') {
        if (state.data) reply({type: 'school-students:context', context: context(state.data, state.revision)});
        return;
      }
      if (message.type === 'school-students:file' && typeof message.requestId === 'string') {
        // Ack at once: the application then waits without a time limit while a picker is open.
        reply({type: 'school-students:file-ack', requestId: message.requestId});
        try {
          if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
          const result = await csvFile(state.data.school.year, message, bridge.rememberedFile);
          reply({type: 'school-students:file-result', requestId: message.requestId, ok: true, result});
        } catch (error) {
          reply({type: 'school-students:file-result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η επιλογή ακυρώθηκε.' : (error?.message || String(error))});
        }
        return;
      }
      if (message.type !== 'school-students:save' || typeof message.requestId !== 'string') return;
      bridge.activity?.();
      try {
        if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
        if (state.busy) throw Error('Μια αποθήκευση βρίσκεται ήδη σε εξέλιξη.');
        if (message.revision !== state.revision || message.year !== state.data.school.year) throw Error('Το κοινό αρχείο άλλαξε. Φόρτωσε ξανά τα στοιχεία της εφαρμογής.');
        const candidate = applySave(state.data, message);
        await bridge.save(candidate);
        const now = bridge.state();
        reply({type: 'school-students:result', requestId: message.requestId, ok: true, context: context(now.data, now.revision)});
      } catch (error) {
        reply({type: 'school-students:result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η αποθήκευση ακυρώθηκε. Οι αλλαγές παραμένουν στη σελίδα.' : (error?.message || String(error))});
      }
    });
  }

  window.SchoolHostStudents = Object.freeze({
    APP, LIMITS, yearStudents, previousYears, context, validateStudents, applySave, csvFile, install
  });
})();
