/*
 * Εφαρμογές σχολείου — Προγράμματα στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.11
 * Όνομα κατά την εγκατάσταση: _host_timetables.js
 *
 * Κώδικας μόνο του host για τα προγράμματα (timetablesByYear). Το φορτώνει το index.html μετά το
 * _data.js και πριν από το δικό του script: <script src="_host_timetables.js"></script>. Δεν το φορτώνουν
 * οι υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostTimetables:
 *   permissions(app)                        τι επιτρέπεται σε μια εφαρμογή
 *   yearData(data, year)                    το timetablesByYear[year] ({periods, programs})
 *   context(data, app, revision)            το school-timetables:context για μια εφαρμογή
 *   validatePeriods(periods, year)          έλεγχος της λίστας περιόδων (πετά λάθος)
 *   validateProgram(program, options)       πλήρης έλεγχος ενός προγράμματος (πετά λάθος)
 *   applySave(data, message, app)           εφαρμογή ενός school-timetables:save σε αντίγραφο
 *   staffUsage(data, year)                  σε ποια προγράμματα εμφανίζεται κάθε εκπαιδευτικός
 *   applyStaffRemovals(data, year, before, after, removals)   αναφορές σε διαγραφή εκπαιδευτικού
 *   importFile(year, message, app)          αρχεία των εισαγωγέων (SchoolTimetable.kinds) για το
 *                                           school-programs:file, το school-fet:file και το school-oloimero:file
 *   oloimeroFile(year, message, app)        τα αρχεία του Ολοήμερου Designer (school-oloimero:file): εισαγωγή,
 *                                           αρχείο FET για Μαθήματα και Τμήματα, εξαγωγή CSV για το FET
 *   droppedImportFile(year, kind, importer, file, handle)   αρχείο που αφέθηκε πάνω σε εφαρμογή· γίνεται
 *                                           το τελευταίο αρχείο του εισαγωγέα
 *   rememberedFile(action, spec)            το κοινό μέρος κάθε αρχείου που θυμάται το host (last / read /
 *                                           choose)· το χρησιμοποιούν και το _host_classes.js και το
 *                                           _host_students.js, μέσω του index. Με spec.encoding:'auto' το
 *                                           κείμενο διαβάζεται ως UTF-8 και, αν δεν είναι, ως Windows-1253
 *   viewKey(app)                            το κλειδί της εφαρμογής στο lastViewByYear (το είδος της), ή null
 *   lastView(data, year, key)               η τελευταία επιλογή μιας εφαρμογής (π.χ. 'period:…' ή 'draft:…')
 *   withView(data, year, key, view)         αντίγραφο του data με νέα τελευταία επιλογή
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-timetables:* και αιτήματα
 *                                           αρχείων)
 * Ο κατάλογος ειδών και οι εισαγωγείς τους διαβάζονται από το SchoolTimetable.kinds του _data.js.
 */
(() => {
  'use strict';
  const T = window.SchoolTimetable, D = window.SchoolDate;
  if (!T || !D) throw Error('Το _host_timetables.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  // Η εφαρμογή «Σχολικά Προγράμματα»: διαχειρίζεται τις περιόδους και τα προγράμματα περιόδων κάθε είδους.
  const PROGRAMS_APP = 'timetables.html';
  // Όρια πλήθους: πιάνουν λάθη εφαρμογών (π.χ. προσχέδια που αντιγράφονται ξανά και ξανά). Πάνω από το όριο η
  // αποθήκευση απορρίπτεται· από το 90% (WARN_RATIO) οι εφαρμογές δείχνουν προειδοποίηση, με τα όρια και τις
  // μετρήσεις του context. programs: όλα τα προγράμματα του έτους, μαζί με τα προσχέδια όλων των εφαρμογών.
  // Το μέγεθος δεν έχει όριο εδώ: το index προειδοποιεί στην αποθήκευση όταν το αρχείο είναι πολύ μεγάλο.
  const LIMITS = Object.freeze({periods: 15, programs: 200, activities: 2000, times: 100, people: 100, text: 2000, ops: 1000});
  const WARN_RATIO = 0.9;
  // Εξαιρέσεις στα δικαιώματα: μια εφαρμογή που αναθέτει σε περίοδο ένα υπάρχον πρόγραμμα άλλου είδους,
  // χωρίς να αλλάζει το περιεχόμενό του. Ο FET Timetable Editor, μετά από Εισαγωγή Ολοημέρου από
  // προσχέδιο, δημιουργεί ανεξάρτητο σχέδιο Ολοημέρου στην περίοδο (νέο id), αφήνοντας το αρχικό
  // προσχέδιο ανέπαφο. Η ενέργεια αποθηκεύεται μαζί με το ωρολόγιο.
  const ASSIGN = Object.freeze({[T.kinds.school.owner]: Object.freeze(['oloimero'])});

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const quoted = value => '«' + value + '»';
  const known = kind => Object.prototype.hasOwnProperty.call(T.kinds, kind);
  const kindLabel = kind => known(kind) ? T.kinds[kind].label : kind;
  const isText = (value, max = LIMITS.text) => typeof value === 'string' && value.length <= max;
  const nowIso = () => new Date().toISOString();
  // JSON με ταξινομημένα κλειδιά: δύο αντικείμενα με το ίδιο περιεχόμενο δίνουν το ίδιο κείμενο.
  const stableJson = value => JSON.stringify(value, (key, item) => isObject(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);

  // ---- Δικαιώματα ----
  // periods: γράφει τη λίστα περιόδων· kinds: τα είδη που γράφει· drafts: 'own' (φτιάχνει, αλλάζει και
  // σβήνει προσχέδια των ειδών του), 'fromPeriod' (μόνο προσχέδιο από πρόγραμμα που ήταν σε περίοδο) ή 'none'·
  // assign: είδη άλλων εφαρμογών που μόνο αναθέτει σε περίοδο (και βλέπει τα προσχέδιά τους).
  function permissions(app) {
    if (app === PROGRAMS_APP) return {app, periods: true, kinds: Object.keys(T.kinds), drafts: 'fromPeriod', assign: []};
    const kinds = Object.keys(T.kinds).filter(kind => T.kinds[kind].owner === app);
    return {app, periods: false, kinds, drafts: kinds.length ? 'own' : 'none', assign: [...(ASSIGN[app] || [])].filter(kind => known(kind) && !kinds.includes(kind))};
  }

  // ---- Δεδομένα του έτους ----
  // Το timetablesByYear[year], ή κενή δομή όταν δεν υπάρχει ακόμη. Δεν αλλάζει το data.
  function yearData(data, year) {
    const value = isObject(data?.timetablesByYear) ? data.timetablesByYear[year] : null;
    return {
      ...(isObject(value) ? value : {}),
      periods: Array.isArray(value?.periods) ? value.periods : [],
      programs: Array.isArray(value?.programs) ? value.programs : []
    };
  }
  const staffOf = (data, year) => Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year] : [];
  const hoursOf = (data, year) => isObject(data?.teachingHoursByYear) ? data.teachingHoursByYear[year] || null : null;
  // Όνομα προγράμματος για μηνύματα: «όνομα» (είδος), ή «είδος» όταν δεν έχει όνομα.
  const programName = program => program?.name ? quoted(program.name) + ' (' + kindLabel(program.kind) + ')' : quoted(kindLabel(program?.kind));

  // ---- Τελευταία επιλογή (lastViewByYear) ----
  // Η εφαρμογή-κάτοχος ενός είδους θυμάται τι έδειχνε τελευταία (περίοδο ή προσχέδιο), ώστε να ανοίγει εκεί.
  // Στο .data: lastViewByYear[year][είδος] = 'period:<id>' | 'draft:<id>'. Δεν μετρά ως αλλαγή δεδομένων:
  // το index το γράφει στο αρχείο με την επόμενη αποθήκευση ή όταν η εφαρμογή κλείνει (school-timetables:view).
  const VIEW_PATTERN = /^(period|draft):[^\s]{1,200}$/;
  function viewKey(app) {
    if (app === PROGRAMS_APP) return null;
    return permissions(app).kinds[0] || null;
  }
  function lastView(data, year, key) {
    const value = isObject(data?.lastViewByYear) && isObject(data.lastViewByYear[year]) ? data.lastViewByYear[year][key] : '';
    return typeof value === 'string' && VIEW_PATTERN.test(value) ? value : '';
  }
  function withView(data, year, key, view) {
    const byYear = isObject(data?.lastViewByYear) ? data.lastViewByYear : {};
    const forYear = isObject(byYear[year]) ? byYear[year] : {};
    return {...data, lastViewByYear: {...byYear, [year]: {...forYear, [key]: view}}};
  }

  // school-timetables:context για μια εφαρμογή: τα προγράμματα περιόδων όλων των γνωστών ειδών και τα
  // προσχέδια των ειδών της εφαρμογής (και των ειδών που αναθέτει). Προγράμματα άγνωστου είδους δεν στέλνονται.
  function context(data, app, revision) {
    const year = data.school.year, timetables = yearData(data, year), rights = permissions(app);
    const drafts = new Set([...(rights.drafts === 'own' ? rights.kinds : []), ...rights.assign]);
    const draftCounts = Object.fromEntries(Object.keys(T.kinds).map(kind => [kind, 0]));
    for (const program of timetables.programs) if (known(program?.kind) && program.periodId == null) draftCounts[program.kind]++;
    return clone({
      revision, school: {...data.school}, year,
      staff: staffOf(data, year), teachingHours: hoursOf(data, year),
      periods: timetables.periods,
      programs: timetables.programs.filter(program => known(program?.kind) && (program.periodId != null || drafts.has(program.kind))),
      draftCounts,
      // For the warnings near the limits: every program of the year (also drafts and unknown kinds).
      programCount: timetables.programs.length,
      // The last design or period this application showed ('' when there is none).
      lastView: viewKey(app) ? lastView(data, year, viewKey(app)) : '',
      limits: {programs: LIMITS.programs, periods: LIMITS.periods, activities: LIMITS.activities, warnRatio: WARN_RATIO}
    });
  }

  // ---- Έλεγχοι ----
  // Έγκυρα δεδομένα JSON, χωρίς κύκλους και υπερβολικό βάθος.
  function checkJson(value, label) {
    const ancestors = new WeakSet();
    let nodes = 0;
    (function walk(item, depth) {
      if (++nodes > 2000000 || depth > 64) throw Error(label + ': τα δεδομένα είναι υπερβολικά σύνθετα.');
      if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
      if (typeof item === 'number' && Number.isFinite(item)) return;
      if (typeof item !== 'object' || ancestors.has(item)) throw Error(label + ': τα δεδομένα δεν είναι έγκυρα δεδομένα JSON.');
      const proto = Object.getPrototypeOf(item);
      if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) throw Error(label + ': μη έγκυρη δομή δεδομένων.');
      ancestors.add(item);
      for (const child of Array.isArray(item) ? item : Object.values(item)) walk(child, depth + 1);
      ancestors.delete(item);
    })(value, 0);
  }
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ''));
  const textList = (value, max = LIMITS.people) => Array.isArray(value) && value.length <= max && value.every(item => isText(item) && item.trim() !== '');
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

  // Λίστα περιόδων: μορφή, μοναδικά id και όνομα, ημερομηνίες μέσα στο σχολικό έτος.
  // Επικαλύψεις, κενό «έως» σε περίοδο που δεν είναι τελευταία κ.λπ. είναι προειδοποιήσεις των εφαρμογών.
  function validatePeriods(periods, year) {
    if (!Array.isArray(periods)) throw Error('Η λίστα περιόδων δεν είναι έγκυρη.');
    if (periods.length > LIMITS.periods) throw Error('Η λίστα θα είχε ' + periods.length + ' περιόδους, πάνω από το όριο των ' + LIMITS.periods + ' ανά σχολικό έτος. Η αποθήκευση δεν έγινε.');
    const range = D.schoolYear(year), ids = new Set();
    if (!range) throw Error('Το σχολικό έτος ' + quoted(year) + ' δεν είναι έγκυρο.');
    periods.forEach((period, index) => {
      const label = 'Η περίοδος ' + (isObject(period) && isText(period.name) && period.name.trim() ? quoted(period.name.trim()) : String(index + 1));
      if (!isObject(period) || !isText(period.id, 200) || !period.id.trim()) throw Error(label + ' δεν έχει έγκυρη ταυτότητα.');
      if (ids.has(period.id)) throw Error('Δύο περίοδοι έχουν την ίδια ταυτότητα.');
      ids.add(period.id);
      if (!isText(period.name, 200) || !period.name.trim()) throw Error('Η περίοδος ' + (index + 1) + ' χρειάζεται όνομα.');
      if (!D.inSchoolYear(period.from, year)) throw Error(label + ' χρειάζεται ημερομηνία έναρξης μέσα στο σχολικό έτος (' + D.format(range.from) + '–' + D.format(range.to) + ').');
      if (period.to !== '' && !D.inSchoolYear(period.to, year)) throw Error(label + ' χρειάζεται ημερομηνία λήξης μέσα στο σχολικό έτος (' + D.format(range.from) + '–' + D.format(range.to) + '), ή κενή.');
    });
  }

  // Validators του source, ανά type. Άγνωστο type γίνεται δεκτό (έχει ήδη ελεγχθεί ως JSON).
  const SOURCE_VALIDATORS = {
    fet(source) {
      const fail = what => { throw Error('τα στοιχεία FET δεν είναι έγκυρα (' + what + ').'); };
      for (const key of ['csvName', 'fetName', 'importedAt']) if (source[key] != null && !isText(source[key])) fail(key);
      if (source.activities != null) {
        if (!isObject(source.activities)) fail('activities');
        for (const item of Object.values(source.activities)) {
          if (!isObject(item) || (item.fetId != null && !isText(item.fetId)) || (item.students != null && !isText(item.students)) || (item.tags != null && !(Array.isArray(item.tags) && item.tags.every(tag => isText(tag))))) fail('activities');
        }
      }
      if (source.students != null && !Array.isArray(source.students)) fail('students');
      if (source.subjects != null && !Array.isArray(source.subjects)) fail('subjects');
      if (source.teachers != null && !(Array.isArray(source.teachers) && source.teachers.every(teacher => isObject(teacher) && isText(teacher.name) && (teacher.staffId == null || isText(teacher.staffId, 1000))))) fail('teachers');
      if (source.unavailable != null && !(Array.isArray(source.unavailable) && source.unavailable.every(item => isObject(item) && isText(item.teacher) && Number.isInteger(item.day) && item.day >= 1 && item.day <= 7 && validTime(item.start) && validTime(item.end) && item.start < item.end))) fail('unavailable');
      if (source.modifiedAfterImport != null && !(isObject(source.modifiedAfterImport) && (source.modifiedAfterImport.replacements == null || Array.isArray(source.modifiedAfterImport.replacements)))) fail('modifiedAfterImport');
      if (source.oloimero != null && !isObject(source.oloimero)) fail('oloimero');
    },
    // Σχέδιο του Ολοήμερου Designer (βλέπε «Σχέδια του Ολοήμερου Designer» στο _data.js).
    'oloimero-designer'(source) {
      const fail = what => { throw Error('τα στοιχεία του Ολοήμερου Designer δεν είναι έγκυρα (' + what + ').'); };
      const slots = T.OLOIMERO_MAX_SLOTS;
      const students = value => Array.isArray(value) && value.length <= 50 && value.every(item => isObject(item) && (item.type === 'department' || item.type === 'union') && isText(item.id, 200));
      const place = item => isObject(item) && isText(item.hourId, 200) && integer(item.day, 1, 5) && integer(item.slot, 0, slots - 1) && students(item.students);
      const named = (value, max) => Array.isArray(value) && value.length <= max && value.every(item => isObject(item) && isText(item.id, 200) && isText(item.name, 300));
      for (const key of ['csvName', 'importedAt']) if (source[key] != null && !isText(source[key])) fail(key);
      if (source.design != null && !(isObject(source.design) && Array.isArray(source.design.hours) && source.design.hours.length <= 60 && source.design.hours.every(item => isObject(item) && isText(item.hourId, 200) && integer(item.count, 0, slots) && typeof item.exceptionsEnabled === 'boolean' && Array.isArray(item.dayCounts) && item.dayCounts.length === 5 && item.dayCounts.every(value => integer(value, 0, slots))))) fail('design');
      if (source.teachers != null && !(Array.isArray(source.teachers) && source.teachers.length <= 200 && source.teachers.every(item => isObject(item) && isText(item.name, 300) && (item.staffId == null || isText(item.staffId, 1000)) && (item.color == null || /^#[0-9a-f]{6}$/i.test(String(item.color))) && (item.availableHours == null || integer(item.availableHours, 0, 99))))) fail('teachers');
      for (const key of ['subjects', 'departments']) if (source[key] != null && !named(source[key], 500)) fail(key);
      if (source.unions != null && !(named(source.unions, 500) && source.unions.every(item => Array.isArray(item.departmentIds) && item.departmentIds.length <= 100 && item.departmentIds.every(id => isText(id, 200))))) fail('unions');
      if (source.styles != null && !isObject(source.styles)) fail('styles');
      if (source.placements != null && !(isObject(source.placements) && Object.values(source.placements).every(place))) fail('placements');
      if (source.pending != null && !(Array.isArray(source.pending) && source.pending.length <= LIMITS.activities && source.pending.every(item => place(item) && (item.staffId == null || isText(item.staffId, 1000)) && (item.name == null || isText(item.name, 300)) && (item.subjectId == null || isText(item.subjectId, 200))))) fail('pending');
    }
  };

  // Πλήρης έλεγχος ενός προγράμματος. options: {staffIds:Set, periodIds:Set}.
  function validateProgram(program, {staffIds, periodIds}) {
    if (!isObject(program) || !isText(program.id, 200) || !program.id.trim()) throw Error('Ένα πρόγραμμα δεν έχει έγκυρη ταυτότητα.');
    const label = 'Το πρόγραμμα ' + programName(program);
    if (program.formatVersion !== 1) throw Error(label + ' έχει άγνωστη μορφή. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');
    if (!known(program.kind)) throw Error('Ένα πρόγραμμα έχει άγνωστο είδος ' + quoted(String(program.kind)) + '.');
    if (program.periodId != null && (!isText(program.periodId, 200) || !periodIds.has(program.periodId))) throw Error(label + ' ανήκει σε περίοδο που δεν υπάρχει.');
    if (program.name != null && !isText(program.name, 300)) throw Error(label + ' έχει μη έγκυρο όνομα.');
    if (program.periodId == null && !String(program.name || '').trim()) throw Error('Ένα προσχέδιο (' + kindLabel(program.kind) + ') χρειάζεται όνομα.');
    for (const key of ['createdAt', 'updatedAt']) if (program[key] != null && !isText(program[key], 100)) throw Error(label + ' έχει μη έγκυρη ημερομηνία.');
    if (!Array.isArray(program.activities)) throw Error(label + ' δεν έχει έγκυρη λίστα δραστηριοτήτων.');
    if (program.activities.length > LIMITS.activities) throw Error(label + ' έχει ' + program.activities.length + ' δραστηριότητες, πάνω από το όριο των ' + LIMITS.activities + ' ανά πρόγραμμα. Η αποθήκευση δεν έγινε.');
    const ids = new Set();
    program.activities.forEach((activity, index) => {
      const where = label + ', δραστηριότητα ' + (index + 1) + (isObject(activity) && isText(activity.subject) && activity.subject ? ' (' + activity.subject + ')' : '');
      if (!isObject(activity) || !isText(activity.id, 200) || !activity.id || ids.has(activity.id)) throw Error(where + ': δεν έχει έγκυρη και μοναδική ταυτότητα.');
      ids.add(activity.id);
      if (!isText(activity.subject ?? '')) throw Error(where + ': μη έγκυρο μάθημα.');
      if (!Array.isArray(activity.staff) || activity.staff.length > LIMITS.people || !activity.staff.every(id => isText(id, 1000))) throw Error(where + ': μη έγκυρη λίστα εκπαιδευτικών.');
      const unknown = activity.staff.find(id => !staffIds.has(id));
      if (unknown != null) throw Error(where + ': εκπαιδευτικός που δεν υπάρχει στο Προσωπικό του σχολικού έτους.');
      for (const key of ['unmatched', 'classes', 'subsets']) if (activity[key] != null && !textList(activity[key])) throw Error(where + ': μη έγκυρη λίστα (' + key + ').');
      if (activity.room != null && !isText(activity.room)) throw Error(where + ': μη έγκυρη αίθουσα.');
      if (!Array.isArray(activity.times) || activity.times.length > LIMITS.times) throw Error(where + ': μη έγκυρες ώρες.');
      for (const time of activity.times) {
        if (!isObject(time) || !Number.isInteger(time.day) || time.day < 1 || time.day > 7) throw Error(where + ': η ημέρα πρέπει να είναι από 1 (Δευτέρα) έως 7 (Κυριακή).');
        if (!validTime(time.start) || !validTime(time.end)) throw Error(where + ': οι ώρες πρέπει να έχουν τη μορφή «ΩΩ:ΛΛ».');
        if (time.start >= time.end) throw Error(where + ': η ώρα έναρξης ' + time.start + ' δεν είναι πριν από τη λήξη ' + time.end + '.');
      }
    });
    if (program.source != null) {
      if (!isObject(program.source)) throw Error(label + ': μη έγκυρα στοιχεία πηγής.');
      const validator = SOURCE_VALIDATORS[program.source.type];
      if (validator) {
        try { validator(program.source); } catch (error) { throw Error(label + ': ' + error.message); }
      }
    }
  }

  // ---- Αποθήκευση ----
  // Εφαρμογή ενός school-timetables:save ({ops, periods}) για την εφαρμογή app σε αντίγραφο του data.
  // Επιστρέφει το νέο data· πετά λάθος χωρίς να αλλάξει τίποτα. Τα ops εφαρμόζονται όλα μαζί ή κανένα.
  function applySave(data, message, app) {
    const year = data.school.year, rights = permissions(app);
    const ops = message?.ops;
    if (!Array.isArray(ops) || ops.length > LIMITS.ops) throw Error('Μη έγκυρο αίτημα αποθήκευσης προγραμμάτων.');
    checkJson(ops, 'Τα προγράμματα');
    const changesPeriods = message.periods !== undefined;
    if (changesPeriods) {
      if (!rights.periods) throw Error('Οι περίοδοι αλλάζουν μόνο από την εφαρμογή «Σχολικά Προγράμματα».');
      checkJson(message.periods, 'Οι περίοδοι');
      validatePeriods(message.periods, year);
    }
    if (!ops.length && !changesPeriods) throw Error('Δεν υπάρχουν αλλαγές για αποθήκευση.');
    if (!rights.kinds.length && !rights.assign.length) throw Error('Η εφαρμογή δεν έχει δικαίωμα να αλλάξει προγράμματα.');

    const candidate = clone(data), current = yearData(candidate, year);
    const periods = changesPeriods ? clone(message.periods) : current.periods;
    const before = new Map(current.programs.filter(program => isObject(program) && typeof program.id === 'string').map(program => [program.id, program]));
    const result = new Map(before), touched = new Set(), puts = [];
    const may = kind => rights.kinds.includes(kind);
    // Είδη που η εφαρμογή μόνο αναθέτει σε περίοδο (ASSIGN): αλλάζει μόνο η περίοδος, και το όνομα όταν γίνεται
    // προσχέδιο· διαγράφει πρόγραμμα περιόδου μόνο όταν στη θέση του ανατίθεται άλλο στην ίδια αποθήκευση·
    // επιτρέπει επίσης νέο πρόγραμμα περιόδου μόνο ως ακριβές αντίγραφο υπάρχοντος προσχεδίου που παραμένει
    // ανέπαφο, και την παλιότερη μετακίνηση προσχεδίου με αντίγραφο για συμβατότητα.
    const assignOnly = kind => !may(kind) && rights.assign.includes(kind);
    const withoutPlace = program => { const {periodId, name, updatedAt, ...rest} = program; return stableJson(rest); };
    const withoutCopy = program => { const {id, periodId, updatedAt, ...rest} = program; return stableJson(rest); };
    const assignDeletes = [], assignMoves = [], assignCopies = [], assignPeriodCopies = [];

    for (const op of ops) {
      if (!isObject(op) || (op.op !== 'put' && op.op !== 'delete')) throw Error('Μη έγκυρη ενέργεια στα προγράμματα.');
      const id = op.op === 'put' ? op.program?.id : op.id;
      if (!isText(id, 200) || !id) throw Error('Ένα πρόγραμμα δεν έχει έγκυρη ταυτότητα.');
      if (touched.has(id)) throw Error('Το ίδιο πρόγραμμα εμφανίζεται δύο φορές στην ίδια αποθήκευση.');
      touched.add(id);
      const existing = before.get(id);
      if (existing && !known(existing.kind)) throw Error('Το πρόγραμμα ' + programName(existing) + ' είναι άγνωστου είδους και δεν αλλάζει από εδώ. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');
      if (existing && !may(existing.kind) && !assignOnly(existing.kind)) throw Error('Η εφαρμογή δεν μπορεί να αλλάξει το πρόγραμμα ' + programName(existing) + '.');
      if (existing && rights.drafts === 'fromPeriod' && existing.periodId == null) throw Error('Το προσχέδιο ' + programName(existing) + ' αλλάζει ή σβήνεται μόνο από την εφαρμογή του είδους του.');
      if (op.op === 'delete') {
        if (!existing) throw Error('Το πρόγραμμα που ζητήθηκε να διαγραφεί δεν υπάρχει πια. Φόρτωσε ξανά τα στοιχεία.');
        if (assignOnly(existing.kind)) {
          if (existing.periodId == null) throw Error('Το προσχέδιο ' + programName(existing) + ' σβήνεται μόνο από την εφαρμογή του είδους του.');
          assignDeletes.push(existing);
        }
        result.delete(id);
        continue;
      }
      const program = clone(op.program);
      if (!known(program.kind)) throw Error('Ένα πρόγραμμα έχει άγνωστο είδος ' + quoted(String(program.kind)) + '.');
      if (assignOnly(program.kind)) {
        if (!existing && program.periodId == null) {
          assignCopies.push(program);
          result.set(id, program);
          puts.push(program);
          continue;
        }
        if (!existing && program.periodId != null) {
          assignPeriodCopies.push(program);
          result.set(id, program);
          puts.push(program);
          continue;
        }
        if (!existing) throw Error('Η εφαρμογή μπορεί μόνο να αναθέσει σε περίοδο ένα υπάρχον πρόγραμμα του είδους ' + quoted(kindLabel(program.kind)) + '.');
        if (withoutPlace(program) !== withoutPlace(existing) || (program.periodId != null && (program.name || '') !== (existing.name || ''))) throw Error('Η εφαρμογή μπορεί μόνο να αναθέσει σε περίοδο το πρόγραμμα ' + programName(existing) + ', χωρίς να αλλάξει το περιεχόμενό του.');
        if (program.periodId != null && program.periodId !== existing.periodId) assignMoves.push(program);
        result.set(id, program);
        puts.push(program);
        continue;
      }
      if (!may(program.kind)) throw Error('Η εφαρμογή δεν μπορεί να γράψει προγράμματα του είδους ' + quoted(kindLabel(program.kind)) + '.');
      if (existing && existing.kind !== program.kind) throw Error('Το είδος ενός προγράμματος δεν αλλάζει.');
      if (rights.drafts === 'fromPeriod' && program.periodId == null && !(existing && existing.periodId != null)) throw Error('Η εφαρμογή «Σχολικά Προγράμματα» φτιάχνει προσχέδιο μόνο από πρόγραμμα που ήταν σε περίοδο.');
      result.set(id, program);
      puts.push(program);
    }
    // Αντίγραφα: το καθένα ίδιο (εκτός από id, περίοδο και ημερομηνία αλλαγής) με ένα προσχέδιο που ανατίθεται σε
    // περίοδο στην ίδια αποθήκευση, ένα αντίγραφο ανά προσχέδιο.
    const copied = new Set();
    for (const copy of assignCopies) {
      const original = assignMoves.map(program => before.get(program.id)).find(item => item && item.periodId == null && item.kind === copy.kind && !copied.has(item.id) && withoutCopy(item) === withoutCopy(copy));
      if (!original) throw Error('Η εφαρμογή μπορεί να φτιάξει πρόγραμμα του είδους ' + quoted(kindLabel(copy.kind)) + ' μόνο ως αντίγραφο του προσχεδίου που ανατίθεται σε περίοδο στην ίδια αποθήκευση, χωρίς αλλαγές.');
      copied.add(original.id);
    }
    // New-period assignment: only one exact copy per original draft, which must remain unchanged.
    // This cannot grant the FET Editor general creation or editing rights over Ολοήμερο designs.
    const assignedFrom = new Set();
    for (const copy of assignPeriodCopies) {
      const original = [...before.values()].find(item => item.periodId == null && item.kind === copy.kind &&
        !assignedFrom.has(item.id) && withoutCopy(item) === withoutCopy(copy) &&
        result.has(item.id) && stableJson(result.get(item.id)) === stableJson(item));
      if (!original) throw Error('Η εφαρμογή μπορεί να αναθέσει νέο σχέδιο περιόδου μόνο ως ακριβές αντίγραφο υπάρχοντος προσχεδίου που παραμένει ανέπαφο.');
      assignedFrom.add(original.id);
    }
    for (const removed of assignDeletes) {
      if (![...assignMoves, ...assignPeriodCopies].some(program => program.kind === removed.kind && program.periodId === removed.periodId)) throw Error('Το πρόγραμμα ' + programName(removed) + ' σβήνεται από εδώ μόνο όταν στη θέση του ανατίθεται άλλο σχέδιο.');
    }

    // Κανόνες του συνόλου: κανένα πρόγραμμα σε περίοδο που δεν υπάρχει, ένα πρόγραμμα ανά είδος και περίοδο.
    const periodIds = new Set(periods.map(period => period.id));
    const slots = new Map();
    for (const program of result.values()) {
      if (!known(program?.kind) || program.periodId == null) continue;
      if (!periodIds.has(program.periodId)) {
        const removed = current.periods.find(period => period.id === program.periodId);
        throw Error(removed
          ? 'Η περίοδος ' + quoted(removed.name) + ' αφαιρείται, αλλά το πρόγραμμα ' + programName(program) + ' μένει σε αυτήν. Κράτησέ το ως προσχέδιο ή διάγραψέ το στην ίδια αποθήκευση.'
          : 'Το πρόγραμμα ' + programName(program) + ' ανήκει σε περίοδο που δεν υπάρχει.');
      }
      const key = program.kind + '\u0000' + program.periodId;
      if (slots.has(key)) {
        const period = periods.find(item => item.id === program.periodId);
        throw Error('Η περίοδος ' + quoted(period?.name || '') + ' έχει ήδη πρόγραμμα του είδους ' + quoted(kindLabel(program.kind)) + '. Κάθε περίοδος έχει το πολύ ένα πρόγραμμα ανά είδος.');
      }
      slots.set(key, program.id);
    }
    if (result.size > LIMITS.programs) throw Error('Το σχολικό έτος θα είχε ' + result.size + ' προγράμματα (μαζί με τα προσχέδια), πάνω από το όριο των ' + LIMITS.programs + '. Η αποθήκευση δεν έγινε. Διάγραψε προσχέδια που δεν χρειάζονται και ξαναδοκίμασε.');

    // Πλήρης έλεγχος μόνο στα προγράμματα που αλλάζουν.
    const staffIds = new Set(staffOf(candidate, year).map(person => person.id));
    for (const program of puts) validateProgram(program, {staffIds, periodIds});

    // Η σειρά των προγραμμάτων μένει ίδια· τα νέα μπαίνουν στο τέλος.
    const programs = [...current.programs.filter(program => !isObject(program) || typeof program.id !== 'string' || result.has(program.id)).map(program => isObject(program) && typeof program.id === 'string' ? result.get(program.id) : program),
      ...[...result.values()].filter(program => !before.has(program.id))];
    if (!isObject(candidate.timetablesByYear)) candidate.timetablesByYear = {};
    candidate.timetablesByYear[year] = {...current, periods, programs};
    return candidate;
  }

  // ---- Προσωπικό ----
  // Σε ποια προγράμματα του έτους εμφανίζεται κάθε εκπαιδευτικός:
  // {[id]: [{programId, kind, kindLabel, name, periodId, periodName, activities}]}.
  function staffUsage(data, year) {
    const timetables = yearData(data, year), usage = {};
    const periodName = id => timetables.periods.find(period => period.id === id)?.name || '';
    for (const program of timetables.programs) {
      if (!Array.isArray(program?.activities)) continue;
      const counts = new Map();
      for (const activity of program.activities) for (const id of new Set(Array.isArray(activity?.staff) ? activity.staff : [])) counts.set(id, (counts.get(id) || 0) + 1);
      for (const [id, activities] of counts) (usage[id] ||= []).push({programId: program.id, kind: program.kind, kindLabel: kindLabel(program.kind), name: program.name || '', periodId: program.periodId ?? null, periodName: periodName(program.periodId), activities});
    }
    return usage;
  }
  const usageText = list => list.map(item => item.kindLabel + ' – ' + (item.periodId ? (item.periodName || 'περίοδος') : 'προσχέδιο') + (item.name ? ' ' + quoted(item.name) : '')).join(', ');

  // Αναφορές στα προγράμματα όταν το Προσωπικό διαγράφει εκπαιδευτικούς (στο data, που είναι ήδη αντίγραφο).
  //   before / after: το Προσωπικό του έτους πριν και μετά· removals: [{id, mode:'unmatch'|'remove'}].
  //   unmatch: το id φεύγει από το staff και στο unmatched μπαίνει το shortName του.
  //   remove: το id φεύγει, και σβήνονται οι δραστηριότητες που έμειναν χωρίς ανθρώπους από αυτή τη διαγραφή.
  //   Ισχύει για όλα τα προγράμματα του έτους, και για τα προσχέδια. Τα source.teachers (FET, Ολοήμερο
  //   Designer) δεν δείχνουν πια τον εκπαιδευτικό. Διαγραμμένος εκπαιδευτικός που εμφανίζεται σε
  //   προγράμματα χωρίς mode: πετά λάθος.
  // → {programs, activities, removedActivities}: πόσα άλλαξαν.
  function applyStaffRemovals(data, year, before, after, removals) {
    const remaining = new Set((after || []).map(person => person.id));
    const removed = (before || []).filter(person => person?.id && !remaining.has(person.id));
    const summary = {programs: 0, activities: 0, removedActivities: 0};
    if (removals != null && (!Array.isArray(removals) || !removals.every(item => isObject(item) && isText(item.id, 1000) && (item.mode === 'unmatch' || item.mode === 'remove')))) throw Error('Μη έγκυρες οδηγίες για τις αναφορές των εκπαιδευτικών που διαγράφονται.');
    if (!removed.length || !isObject(data.timetablesByYear?.[year])) return summary;
    const usage = staffUsage(data, year), modes = new Map((removals || []).map(item => [item.id, item.mode]));
    const missing = removed.filter(person => usage[person.id] && !modes.has(person.id));
    if (missing.length) throw Error(missing.map(person => quoted(person.shortName || person.name || person.code || 'χωρίς όνομα') + ' εμφανίζεται σε προγράμματα (' + usageText(usage[person.id]) + ')').join('· ') + '. Η αποθήκευση δεν έγινε. Βεβαιώσου ότι το school_staff.html είναι η τελευταία έκδοση.');
    const targets = new Map(removed.filter(person => usage[person.id]).map(person => [person.id, {mode: modes.get(person.id), name: String(person.shortName || person.name || person.code || '').trim()}]));
    // Τα source.teachers ενός προγράμματος μπορεί να δείχνουν εκπαιδευτικό χωρίς δραστηριότητες· καθαρίζονται για
    // κάθε διαγραμμένο, ακόμη κι όταν δεν εμφανίζεται σε δραστηριότητες.
    const removedIds = new Set(removed.map(person => person.id));
    const at = nowIso();
    for (const program of data.timetablesByYear[year].programs || []) {
      if (!Array.isArray(program?.activities)) continue;
      let changed = false;
      if (targets.size) program.activities = program.activities.filter(activity => {
        if (!Array.isArray(activity?.staff) || !activity.staff.some(id => targets.has(id))) return true;
        changed = true; summary.activities++;
        const hits = activity.staff.filter(id => targets.has(id));
        activity.staff = activity.staff.filter(id => !targets.has(id));
        for (const id of hits) {
          const target = targets.get(id);
          if (target.mode === 'unmatch' && target.name) {
            activity.unmatched = Array.isArray(activity.unmatched) ? activity.unmatched : [];
            if (!activity.unmatched.includes(target.name)) activity.unmatched.push(target.name);
          }
        }
        const empty = !activity.staff.length && !(Array.isArray(activity.unmatched) && activity.unmatched.length);
        if (empty && hits.some(id => targets.get(id).mode === 'remove')) { summary.removedActivities++; return false; }
        return true;
      });
      if (Array.isArray(program.source?.teachers)) for (const teacher of program.source.teachers) {
        if (isObject(teacher) && removedIds.has(teacher.staffId)) { teacher.staffId = null; changed = true; }
      }
      if (changed) { program.updatedAt = at; summary.programs++; }
    }
    return summary;
  }

  // ---- Αρχεία ----
  // Οι εφαρμογές διαβάζουν και γράφουν αρχεία μέσω του host (school-programs:file, school-fet:file,
  // school-oloimero:file), γιατί τα file handles δεν περνούν από το iframe σε file://. Τα αρχεία κάθε εισαγωγέα τα
  // δηλώνει το SchoolTimetable.kinds. Για κάθε σχολικό έτος, είδος, εισαγωγέα και αρχείο το host θυμάται
  // (IndexedDB) το τελευταίο αρχείο και το ξαναδιαβάζει σε κάθε εισαγωγή. Σε file:// το Chrome δεν θυμάται τον
  // φάκελο μέσω του id, γι' αυτό το τελευταίο αρχείο δίνεται ως startIn.
  //   message: {action:'last'|'read'|'choose', kind, importer, file}
  //   last   → {name} του τελευταίου αρχείου, ή null
  //   read   → {name, text} του τελευταίου αρχείου (ζητά άδεια ανάγνωσης αν χρειάζεται), ή null
  //   choose → {name, text} του αρχείου που επιλέγει ο χρήστης· γίνεται το τελευταίο αρχείο
  // Η εφαρμογή πρέπει να έχει δικαίωμα εγγραφής στο είδος.
  const IMPORT_MAX_BYTES = 30 * 1024 * 1024;
  const EXPORT_MAX_CHARS = 50 * 1024 * 1024;
  const FILE_ACTIONS = ['last', 'read', 'choose'];
  function referenceStore(operation, key, value) {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { resolve(null); return; }
      const request = indexedDB.open('school-apps-local-files', 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('references')) request.result.createObjectStore('references'); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('references', operation === 'get' ? 'readonly' : 'readwrite'), store = tx.objectStore('references');
        let item;
        try { item = operation === 'get' ? store.get(key) : store.put(value, key); }
        catch (error) { db.close(); reject(error); return; }
        tx.oncomplete = () => { db.close(); resolve(item.result); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || Error('Δεν αποθηκεύτηκε η αναφορά του αρχείου.')); };
      };
    });
  }
  // The text of a file. encoding 'auto': UTF-8 when the bytes are valid UTF-8, otherwise Windows-1253 (the Greek
  // code page in which e.g. the CSV exports of myschool are saved). Without it: UTF-8, as file.text().
  async function fileText(file, encoding) {
    if (encoding !== 'auto') return file.text();
    const bytes = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch { return new TextDecoder('windows-1253').decode(bytes); }
  }
  async function readHandle(handle, encoding) {
    let file;
    try { file = await handle.getFile(); }
    catch (error) { if (error?.name === 'NotFoundError') throw Error('Το αρχείο ' + quoted(handle.name) + ' δεν βρέθηκε. Επίλεξέ το ξανά από τη νέα του θέση.'); throw error; }
    if (file.size > IMPORT_MAX_BYTES) throw Error('Το αρχείο ' + quoted(file.name) + ' είναι υπερβολικά μεγάλο.');
    return {name: file.name, text: await fileText(file, encoding)};
  }
  const rememberedHandle = async key => {
    try { const handle = await referenceStore('get', key); return handle && typeof handle.getFile === 'function' ? handle : null; } catch { return null; }
  };
  // Opens a picker in the folder of startIn; a remembered file that was moved or deleted makes startIn fail,
  // and the picker then opens again without it.
  async function picker(kind, options, startIn) {
    const open = kind === 'save' ? window.showSaveFilePicker : window.showOpenFilePicker;
    if (typeof open !== 'function') throw Error('Η επιλογή αρχείων χρειάζεται Google Chrome ή άλλο Chromium browser.');
    try { return await open.call(window, startIn ? {...options, startIn} : options); }
    catch (error) {
      if (error?.name === 'AbortError' || !startIn) throw error;
      return open.call(window, options);
    }
  }
  // The common part of every remembered file: last / read / choose.
  //   spec: {key (IndexedDB key), pickerId (≤ 32 characters, a limit of Chrome), description, accept,
  //          startIn: async () => handle of a related file, for the folder of the picker when there is no last file,
  //          encoding: 'auto' to accept Windows-1253 as well as UTF-8 (see fileText)}
  async function rememberedFile(action, spec) {
    if (action === 'last') { const handle = await rememberedHandle(spec.key); return handle ? {name: handle.name} : null; }
    if (action === 'read') {
      const handle = await rememberedHandle(spec.key);
      if (!handle) return null;
      let permission = typeof handle.queryPermission === 'function' ? await handle.queryPermission({mode: 'read'}) : 'granted';
      if (permission !== 'granted' && typeof handle.requestPermission === 'function') {
        try { permission = await handle.requestPermission({mode: 'read'}); } catch { permission = 'denied'; }
      }
      if (permission !== 'granted') throw Error('Δεν δόθηκε άδεια ανάγνωσης του ' + quoted(handle.name) + '. Πάτησε «Επιλογή άλλου…» και επίλεξέ το ξανά.');
      return readHandle(handle, spec.encoding);
    }
    const startIn = await rememberedHandle(spec.key) || (spec.startIn ? await spec.startIn().catch(() => null) : null);
    const handles = await picker('open', {id: spec.pickerId.slice(0, 32), multiple: false, types: [{description: spec.description, accept: spec.accept}]}, startIn);
    const result = await readHandle(handles[0], spec.encoding);
    await referenceStore('put', spec.key, handles[0]).catch(() => {});
    return result;
  }
  const importKey = (year, kind, importer, file) => 'programs-import:' + year + ':' + kind + ':' + importer + ':' + file;
  function importSpec(message, app) {
    const importer = T.importer(message?.kind, message?.importer), spec = importer?.files.find(file => file.key === message?.file);
    if (!spec) throw Error('Άγνωστο αρχείο εισαγωγής. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    if (app !== undefined && !permissions(app).kinds.includes(message.kind)) throw Error('Η εφαρμογή δεν μπορεί να εισαγάγει προγράμματα του είδους ' + quoted(kindLabel(message.kind)) + '.');
    return {importer, spec};
  }
  async function importFile(year, message, app) {
    if (!FILE_ACTIONS.includes(message?.action)) throw Error('Άγνωστη ενέργεια αρχείου εισαγωγής. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    const {importer, spec} = importSpec(message, app);
    const keyOf = file => importKey(year, message.kind, importer.id, file);
    return rememberedFile(message.action, {
      key: keyOf(spec.key), pickerId: 'sp-' + message.kind + '-' + importer.id + '-' + spec.key,
      description: spec.description || spec.label, accept: spec.accept,
      // Starts in the folder of another file of the same importer.
      startIn: async () => {
        for (const other of importer.files) if (other.key !== spec.key) { const handle = await rememberedHandle(keyOf(other.key)); if (handle) return handle; }
        return null;
      }
    });
  }

  // An import file dropped on an application (the Index lays its overlay over the iframe and receives the drop):
  // read like a chosen file, and it becomes the last file of the importer. → {name, text}.
  async function droppedImportFile(year, kind, importerId, fileKey, handle) {
    const {spec} = importSpec({kind, importer: importerId, file: fileKey});
    const extensions = Object.values(spec.accept || {}).flat().map(item => String(item).toLowerCase());
    if (extensions.length && !extensions.some(ending => String(handle?.name || '').toLowerCase().endsWith(ending))) throw Error('Μπορείς να αφήσεις εδώ ένα αρχείο ' + extensions.join(' ή ') + '.');
    const result = await readHandle(handle);
    await referenceStore('put', importKey(year, kind, importerId, fileKey), handle).catch(() => {});
    return result;
  }

  // The files of the Ολοήμερο Designer (school-oloimero:file):
  //   {action:'last'|'read'|'choose', kind:'oloimero', importer, file}  the file of an importer (importFile)
  //   {action:'last'|'read'|'choose', reference:'fet'}                 a .fet file for the Μαθήματα and Τμήματα of
  //                                                                    the sidebar; remembered per school year
  //   {action:'export', suggestedName, text}                           saves the CSV for FET → {name}; the picker
  //                                                                    starts in the folder of the last export
  async function oloimeroFile(year, message, app) {
    const owner = T.kinds.oloimero.owner;
    if (app !== undefined && app !== owner) throw Error('Τα αρχεία του Ολοήμερου Designer τα ζητά μόνο ο ' + quoted(T.kinds.oloimero.ownerTitle) + '.');
    if (message?.action === 'export') {
      if (typeof message.text !== 'string' || message.text.length > EXPORT_MAX_CHARS) throw Error('Τα δεδομένα του CSV δεν είναι έγκυρα.');
      const key = 'oloimero-export:' + year;
      const startIn = await rememberedHandle(key) || await rememberedHandle(importKey(year, 'oloimero', 'csv', 'csv'));
      const name = String(message.suggestedName || 'oloimero_fet.csv').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 200) || 'oloimero_fet.csv';
      const handle = await picker('save', {id: 'ol-export', suggestedName: name, types: [{description: 'CSV δραστηριοτήτων για το FET', accept: {'text/csv': ['.csv']}}]}, startIn);
      const writer = await handle.createWritable();
      try { await writer.write(new Blob([message.text], {type: 'text/csv;charset=utf-8'})); await writer.close(); }
      catch (error) { await writer.abort().catch(() => {}); throw error; }
      await referenceStore('put', key, handle).catch(() => {});
      return {name: handle.name};
    }
    if (!FILE_ACTIONS.includes(message?.action)) throw Error('Άγνωστη ενέργεια αρχείου. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    if (message.reference === 'fet') {
      return rememberedFile(message.action, {
        key: 'oloimero-fet-reference:' + year, pickerId: 'ol-fet-reference', description: 'Αρχείο FET', accept: {'application/xml': ['.fet']},
        startIn: () => rememberedHandle(importKey(year, 'school', 'fet', 'fet'))
      });
    }
    if (message.reference != null) throw Error('Άγνωστη ενέργεια αρχείου. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    return importFile(year, message, app);
  }

  // ---- Σύνδεση με το index ----
  // bridge: {
  //   frame                  το iframe των υποεφαρμογών,
  //   acceptOrigin(event)    true όταν το origin του μηνύματος γίνεται δεκτό,
  //   targetOrigin           το origin των απαντήσεων ('*' σε file://),
  //   state()                → {data, revision, app, locked, busy} του index τη στιγμή της κλήσης,
  //   save(candidate)        Promise: γράφει το νέο data στο κοινό αρχείο και το κάνει τρέχον,
  //   activity()             μηδενίζει το ρολόι αδράνειας
  // }
  // Αιτήματα αρχείων, ανά τύπο μηνύματος: η εφαρμογή που τα στέλνει και η συνάρτηση που τα εξυπηρετεί.
  const FILE_REQUESTS = {
    'school-programs:file': {app: () => PROGRAMS_APP, run: importFile},
    'school-fet:file': {app: () => T.kinds.school.owner, run: importFile},
    'school-oloimero:file': {app: () => T.kinds.oloimero.owner, run: oloimeroFile}
  };
  function install(bridge) {
    let fileBusy = false;
    window.addEventListener('message', async event => {
      const message = event.data;
      if (event.source !== bridge.frame.contentWindow || !bridge.acceptOrigin(event)) return;
      if (!isObject(message) || typeof message.type !== 'string') return;
      const files = Object.prototype.hasOwnProperty.call(FILE_REQUESTS, message.type) ? FILE_REQUESTS[message.type] : null;
      if (!files && !message.type.startsWith('school-timetables:')) return;
      const state = bridge.state();
      if (state.locked || !state.app) return;
      const app = state.app, source = event.source;
      const reply = payload => { const now = bridge.state(); if (now.app === app && source === bridge.frame.contentWindow) source.postMessage(payload, bridge.targetOrigin); };
      if (files) {
        if (app !== files.app() || typeof message.requestId !== 'string') return;
        // Acknowledge at once: the application then waits without a time limit while a picker is open.
        reply({type: message.type + '-ack', requestId: message.requestId});
        if (fileBusy) { reply({type: message.type + '-result', requestId: message.requestId, ok: false, error: 'Μια επιλογή αρχείου βρίσκεται ήδη σε εξέλιξη.'}); return; }
        fileBusy = true; bridge.activity?.();
        try {
          if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
          const result = await files.run(state.data.school.year, message, app);
          reply({type: message.type + '-result', requestId: message.requestId, ok: true, result});
        } catch (error) {
          reply({type: message.type + '-result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η επιλογή αρχείου ακυρώθηκε.' : (error?.message || String(error))});
        } finally { fileBusy = false; }
        return;
      }
      if (message.type === 'school-timetables:ready') {
        if (state.data) reply({type: 'school-timetables:context', context: context(state.data, app, state.revision)});
        return;
      }
      // The selection of the application changed: the index keeps it, without marking any change of data.
      if (message.type === 'school-timetables:view') {
        const key = viewKey(app);
        if (!state.data || !key || typeof message.view !== 'string' || !VIEW_PATTERN.test(message.view)) return;
        if (lastView(state.data, state.data.school.year, key) !== message.view) bridge.view?.(state.data.school.year, key, message.view);
        return;
      }
      if (message.type !== 'school-timetables:save' || typeof message.requestId !== 'string') return;
      bridge.activity?.();
      try {
        if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
        if (state.busy) throw Error('Μια αποθήκευση βρίσκεται ήδη σε εξέλιξη.');
        if (message.revision !== state.revision || message.year !== state.data.school.year) throw Error('Το κοινό αρχείο άλλαξε. Φόρτωσε ξανά τα στοιχεία της εφαρμογής.');
        const candidate = applySave(state.data, message, app);
        await bridge.save(candidate);
        const now = bridge.state();
        reply({type: 'school-timetables:result', requestId: message.requestId, ok: true, context: context(now.data, app, now.revision)});
      } catch (error) {
        reply({type: 'school-timetables:result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η αποθήκευση ακυρώθηκε. Οι αλλαγές παραμένουν στη σελίδα.' : (error?.message || String(error))});
      }
    });
  }

  window.SchoolHostTimetables = Object.freeze({
    PROGRAMS_APP, LIMITS, WARN_RATIO, permissions, yearData, context,
    validatePeriods, validateProgram, applySave, viewKey, lastView, withView,
    staffUsage, applyStaffRemovals, importFile, oloimeroFile, droppedImportFile, rememberedFile, install
  });
})();
