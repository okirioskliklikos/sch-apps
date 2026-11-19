/*
 * Εφαρμογές σχολείου — Προγράμματα στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.24
 * Όνομα κατά την εγκατάσταση: _host_timetables.js
 *
 * Κώδικας μόνο του host για τα προγράμματα (timetablesByYear). Το φορτώνει το index.html μετά το
 * _data.js και πριν από το δικό του script: <script src="_host_timetables.js"></script>. Δεν το φορτώνουν
 * οι υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostTimetables:
 *   permissions(app)                        τι επιτρέπεται σε μια εφαρμογή
 *   yearData(data, year)                    το timetablesByYear[year] ({periods, programs, individualCatalog})
 *   individualCatalog(data, year)           ο κατάλογος του έτους των Ατομικών Προγραμμάτων (μαθήματα, Συνενώσεις)
 *   validateCatalog(catalog, options)       έλεγχος του καταλόγου των Ατομικών Προγραμμάτων (πετά λάθος)
 *   checkCatalogAdditions(before, after)    ο κατάλογος που στέλνουν τα Σχολικά Προγράμματα έχει μόνο προσθήκες στο
 *                                           τέλος (επαναφορά από αντίγραφο ασφαλείας· πετά λάθος)
 *   context(data, app, revision)            το school-timetables:context για μια εφαρμογή
 *   validatePeriods(periods, year, options) έλεγχος της λίστας περιόδων: Επίσημες και Προσχέδια περιόδων (χωρίς
 *                                           ημερομηνίες), διαθέσιμες ώρες Ολοημέρου (πετά λάθος)
 *   withoutDraftDates(periods)              η λίστα περιόδων με κενές ημερομηνίες στα Προσχέδια περιόδων (παλαιότερα
 *                                           αρχεία· δεν αλλάζει τη λίστα που παίρνει)
 *   validateProgram(program, options)       πλήρης έλεγχος ενός προγράμματος, μαζί με το Ιστορικό και την αρχική
 *                                           κατάστασή του (πετά λάθος)
 *   applySave(data, message, app)           εφαρμογή ενός school-timetables:save σε αντίγραφο· κρατά την αρχική
 *                                           κατάσταση κάθε προγράμματος (SchoolTimetable.keepInitial)
 *   staffUsage(data, year)                  σε ποια προγράμματα εμφανίζεται κάθε εκπαιδευτικός
 *   applyStaffRemovals(data, year, before, after, removals)   αναφορές σε διαγραφή εκπαιδευτικού
 *   importFile(year, message, app)          αρχεία των εισαγωγέων (SchoolTimetable.kinds) για το
 *                                           school-programs:file, το school-fet:file και το school-oloimero:file
 *   programsFile(year, message, app)        τα αρχεία των Σχολικών Προγραμμάτων (school-programs:file): εισαγωγή,
 *                                           αποθήκευση και άνοιγμα αντιγράφου ασφαλείας περιόδου
 *   oloimeroFile(year, message, app)        τα αρχεία του Ολοήμερου Designer (school-oloimero:file): εισαγωγή,
 *                                           αρχείο FET για Μαθήματα και Τμήματα, εξαγωγή CSV για το FET
 *   droppedImportFile(year, kind, importer, file, handle)   αρχείο που αφέθηκε πάνω σε εφαρμογή· γίνεται
 *                                           το τελευταίο αρχείο του εισαγωγέα
 *   rememberedFile(action, spec)            το κοινό μέρος κάθε αρχείου που θυμάται το host (last / read /
 *                                           choose)· το χρησιμοποιούν και το _host_classes.js και το
 *                                           _host_students.js, μέσω του index. Με spec.encoding:'auto' το
 *                                           κείμενο διαβάζεται ως UTF-8 και, αν δεν είναι, ως Windows-1253
 *   viewKey(app)                            το κλειδί της εφαρμογής στο lastViewByYear (το είδος της), ή null
 *   lastView(data, year, key)               η τελευταία επιλογή μιας εφαρμογής (π.χ. 'period:…' ή,
 *                                           στα Ατομικά Προγράμματα, 'period:…|staff:…')
 *   withView(data, year, key, view)         αντίγραφο του data με νέα τελευταία επιλογή
 *   currentPeriod(data, year)               η κοινή τρέχουσα περίοδος των Σχολικών Προγραμμάτων και των εφαρμογών
 *                                           προγραμμάτων (lastViewByYear[year].period), ή ''
 *   periodViews(data, year, periodId)       οι αλλαγές στο lastViewByYear όταν αλλάζει η κοινή τρέχουσα περίοδος:
 *                                           [[κλειδί, τιμή]…] (η κοινή περίοδος και η επιλογή κάθε εφαρμογής-κατόχου)
 *   openTarget(data, year, message, app)    έλεγχος ενός school-timetables:open: → {file, target}
 *   zoom(data, key)                         το ζουμ του πίνακα μιας εφαρμογής-κατόχου (timetableSettings.zoom[είδος],
 *                                           κοινό για όλα τα σχολικά έτη), ή η προεπιλογή του είδους
 *   withZoom(data, key, value)              αντίγραφο του data με νέο ζουμ
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-timetables:* και αιτήματα
 *                                           αρχείων)
 * Ο κατάλογος ειδών και οι εισαγωγείς τους διαβάζονται από το SchoolTimetable.kinds του _data.js.
 * Οι εφαρμογές που μόνο διαβάζουν προγράμματα (π.χ. Σχολικό Ημερολόγιο) δεν βλέπουν τα Προσχέδια περιόδων και τα
 * προγράμματά τους. Την αρχική κατάσταση των προγραμμάτων (program.initial) την κρατά μόνο το host.
 * Τα προγράμματα είναι στη μορφή formatVersion:2: οι δραστηριότητες αναφέρονται στα τμήματα του
 * classesByYear[year] με το id τους (classes), τα ονόματα μαθητών των αρχείων που δεν είναι τμήματα είναι στο
 * otherStudents, και τα σχέδια του Ολοήμερου Designer έχουν source.version:2. Τα νέα τμήματα μιας εισαγωγής
 * (newClasses του school-timetables:save) τα προσθέτει το _host_classes.js (addClasses), που φορτώνεται μετά.
 */
(() => {
  'use strict';
  const T = window.SchoolTimetable, D = window.SchoolDate;
  if (!T || !D) throw Error('Το _host_timetables.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  // Η εφαρμογή «Σχολικά Προγράμματα» (η κεντρική σελίδα των προγραμμάτων): διαχειρίζεται τις περιόδους και τα
  // προγράμματα περιόδων κάθε είδους.
  const PROGRAMS_APP = 'timetables.html';
  const PROGRAMS_TITLE = 'Σχολικά Προγράμματα';
  // Όρια πλήθους: πιάνουν λάθη εφαρμογών (π.χ. προγράμματα που αντιγράφονται ξανά και ξανά). Πάνω από το όριο η
  // αποθήκευση απορρίπτεται· από το 90% (WARN_RATIO) οι εφαρμογές δείχνουν προειδοποίηση, με τα όρια και τις
  // μετρήσεις του context. programs: όλα τα προγράμματα του έτους. Κάθε πρόγραμμα ανήκει σε περίοδο:
  // δεν υπάρχουν προσχέδια προγραμμάτων χωρίς περίοδο.
  // Το μέγεθος δεν έχει όριο εδώ: το index προειδοποιεί στην αποθήκευση όταν το αρχείο είναι πολύ μεγάλο.
  const LIMITS = Object.freeze({periods: 15, programs: 200, activities: 2000, times: 100, people: 100, text: 2000, ops: 1000});
  const WARN_RATIO = 0.9;
  // Εφαρμογές που γράφουν και είδος που δεν είναι δικό τους, μόνο σε προγράμματα περιόδων (όχι διαγραφή,
  // όχι τον κατάλογο): το Πλήρες Σχολικό Πρόγραμμα (fet_timetable_editor.html) αλλάζει και τις πρωινές ώρες των
  // Ατομικών Προγραμμάτων. Τα σχέδια του Ολοημέρου τα γράφουν μόνο ο Ολοήμερος Designer και τα Σχολικά Προγράμματα.
  const WRITERS = Object.freeze({individual: Object.freeze([T.kinds.school.owner])});

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
  // periods: γράφει τη λίστα περιόδων· kinds: τα είδη που γράφει· owned: τα είδη της (εφαρμογή-κάτοχος)· oloimeroHours: γράφει τις διαθέσιμες ώρες Ολοημέρου των περιόδων. Τα είδη του kinds που δεν είναι στο owned (WRITERS)
  // τα γράφει μόνο σε προγράμματα περιόδων.
  function permissions(app) {
    if (app === PROGRAMS_APP) return {app, periods: true, kinds: Object.keys(T.kinds), owned: [], oloimeroHours: true};
    const owned = Object.keys(T.kinds).filter(kind => T.kinds[kind].owner === app);
    const kinds = Object.keys(T.kinds).filter(kind => owned.includes(kind) || (WRITERS[kind] || []).includes(app));
    return {app, periods: false, kinds, owned, oloimeroHours: owned.includes('oloimero')};
  }
  // Εφαρμογή που μόνο διαβάζει προγράμματα (π.χ. Σχολικό Ημερολόγιο): δεν βλέπει τα Προσχέδια περιόδων.
  const readerOnly = rights => !rights.periods && !rights.kinds.length;

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
  // Τα Τμήματα του έτους (classesByYear[year].classes) και το όριό τους. Το _host_classes.js φορτώνεται μετά από
  // αυτό το αρχείο, γι' αυτό διαβάζεται τη στιγμή της κλήσης.
  const hostClasses = () => window.SchoolHostClasses || null;
  const classesOf = (data, year) => { const value = isObject(data?.classesByYear) ? data.classesByYear[year] : null; return Array.isArray(value?.classes) ? value.classes.filter(isObject) : []; };
  const classLimit = () => hostClasses()?.LIMITS?.classes || 50;
  // Όνομα προγράμματος για μηνύματα: «όνομα» (είδος), ή «είδος» όταν δεν έχει όνομα.
  const programName = program => program?.name ? quoted(program.name) + ' (' + kindLabel(program.kind) + ')' : quoted(kindLabel(program?.kind));

  // ---- Κατάλογος των Ατομικών Προγραμμάτων (timetablesByYear[year].individualCatalog) ----
  // {subjects:[{id, name, color, hidden}], unions:[{id, name, grades, classIds}], hidden:{grades, classes}}, κοινός για
  // όλες τις περιόδους του έτους. Τον γράφει μόνο η εφαρμογή-κάτοχος του είδους individual (individualCatalog του
  // school-timetables:save). Πεδία που δεν γνωρίζει το host μένουν όπως είναι.
  const CATALOG_LIMITS = Object.freeze({subjects: 500, unions: 500});
  function individualCatalog(data, year) {
    const value = isObject(data?.timetablesByYear?.[year]) ? data.timetablesByYear[year].individualCatalog : null;
    const catalog = isObject(value) ? value : {};
    return {
      ...catalog,
      subjects: Array.isArray(catalog.subjects) ? catalog.subjects : [],
      unions: Array.isArray(catalog.unions) ? catalog.unions : [],
      hidden: isObject(catalog.hidden) ? catalog.hidden : {grades: [], classes: []}
    };
  }
  // Έλεγχος του καταλόγου. Απορρίπτει μόνο ό,τι χαλά τα δεδομένα (μορφή, διπλά id, χρώμα, άγνωστη Τάξη)· τα ονόματα
  // τα ελέγχει η εφαρμογή. Τμήματα που δεν υπάρχουν πια στις Συνενώσεις και στο hidden γίνονται δεκτά και αγνοούνται,
  // όπως στα κρυφά Τμήματα του Ολοήμερου Designer.
  function validateCatalog(catalog) {
    const fail = what => { throw Error('Ο κατάλογος των Ατομικών Προγραμμάτων δεν είναι έγκυρος (' + what + ').'); };
    const grades = value => Array.isArray(value) && value.length <= GRADES.length && value.every(grade => GRADES.includes(grade));
    const ids = value => Array.isArray(value) && value.length <= 100 && value.every(id => isText(id, 200) && !!id);
    if (!isObject(catalog)) fail('μορφή');
    const subjects = catalog.subjects ?? [], unions = catalog.unions ?? [];
    if (!Array.isArray(subjects) || subjects.length > CATALOG_LIMITS.subjects) fail('μαθήματα');
    const subjectIds = new Set();
    for (const item of subjects) {
      if (!isObject(item) || !isText(item.id, 200) || !item.id || subjectIds.has(item.id) || !isText(item.name, 300) || !item.name.trim()) fail('μαθήματα');
      subjectIds.add(item.id);
      if (item.color != null && item.color !== '' && !/^#[0-9a-f]{6}$/i.test(String(item.color))) fail('χρώμα μαθήματος');
      if (item.hidden != null && typeof item.hidden !== 'boolean') fail('μαθήματα');
    }
    if (!Array.isArray(unions) || unions.length > CATALOG_LIMITS.unions) fail('Συνενώσεις');
    const unionIds = new Set();
    for (const union of unions) {
      if (!isObject(union) || !isText(union.id, 200) || !union.id || unionIds.has(union.id) || !isText(union.name, 300) || !union.name.trim()) fail('Συνενώσεις');
      unionIds.add(union.id);
      if (union.grades != null && !grades(union.grades)) fail('Συνενώσεις');
      if (union.classIds != null && !ids(union.classIds)) fail('Συνενώσεις');
    }
    if (catalog.hidden != null && !(isObject(catalog.hidden) && (catalog.hidden.grades == null || grades(catalog.hidden.grades)) && (catalog.hidden.classes == null || ids(catalog.hidden.classes)))) fail('hidden');
    return {subjectIds, unionIds};
  }
  // «Σχολικά Προγράμματα» send the catalog only with additions (the subjects and the Συνενώσεις of a backup that the
  // year does not have): every item that exists stays exactly the same and in its place, the new ones are at the end,
  // and nothing else of the catalog changes. Throws an error otherwise.
  function checkCatalogAdditions(before, after) {
    const fail = () => { throw Error('Τα «' + PROGRAMS_TITLE + '» μπορούν μόνο να προσθέσουν μαθήματα και Συνενώσεις στον κατάλογο των Ατομικών Προγραμμάτων, όχι να αλλάξουν ή να σβήσουν όσα υπάρχουν. Φόρτωσε ξανά τα στοιχεία και ξαναδοκίμασε.'); };
    if (!isObject(after)) fail();
    const rest = value => { const {subjects, unions, ...others} = value; return stableJson({...others, hidden: isObject(value.hidden) ? value.hidden : {grades: [], classes: []}}); };
    if (rest(before) !== rest(after)) fail();
    for (const key of ['subjects', 'unions']) {
      const old = Array.isArray(before[key]) ? before[key] : [], now = Array.isArray(after[key]) ? after[key] : [];
      if (now.length < old.length || old.some((item, index) => stableJson(item) !== stableJson(now[index]))) fail();
    }
  }

  // ---- Τελευταία επιλογή (lastViewByYear) ----
  // Η εφαρμογή-κάτοχος ενός είδους θυμάται σε ποια περίοδο ήταν τελευταία, ώστε να ανοίγει εκεί.
  // Στο .data: lastViewByYear[year][είδος] = 'period:<id>' (στα Ατομικά Προγράμματα και ο εκπαιδευτικός:
  // 'period:<id>|staff:<id>', που το δέχεται το ίδιο μοτίβο). Δεν μετρά ως αλλαγή δεδομένων:
  // το index το γράφει στο αρχείο με την επόμενη αποθήκευση ή όταν η εφαρμογή κλείνει (school-timetables:view).
  const VIEW_PATTERN = /^period:[^\s]{1,200}$/;
  function viewKey(app) {
    if (app === PROGRAMS_APP) return null;
    return permissions(app).owned[0] || null;
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

  // ---- Κοινή τρέχουσα περίοδος ----
  // Η περίοδος όπου δούλεψε τελευταία ο χρήστης, κοινή για τα Σχολικά Προγράμματα και τις εφαρμογές προγραμμάτων:
  // όποια την αλλάζει, οι άλλες ανοίγουν σε αυτήν. Στο .data: lastViewByYear[year].period = 'period:<id>'. Όπως η
  // τελευταία επιλογή, δεν μετρά ως αλλαγή δεδομένων. Όταν αλλάζει, η τελευταία επιλογή κάθε εφαρμογής-κατόχου γίνεται
  // η ίδια περίοδος (στα Ατομικά Προγράμματα μένει ο εκπαιδευτικός).
  const PERIOD_KEY = 'period';
  // Οι εφαρμογές που μοιράζονται την τρέχουσα περίοδο και ανοίγουν η μία την άλλη: τα Σχολικά Προγράμματα και όσες
  // γράφουν προγράμματα.
  const sharesPeriod = app => app === PROGRAMS_APP || permissions(app).kinds.length > 0;
  function currentPeriod(data, year) {
    const value = lastView(data, year, PERIOD_KEY);
    const id = value.startsWith('period:') ? value.slice(7).split('|')[0] : '';
    return id && yearData(data, year).periods.some(period => isObject(period) && period.id === id) ? id : '';
  }
  function periodViews(data, year, periodId) {
    const changes = [];
    if (lastView(data, year, PERIOD_KEY) !== 'period:' + periodId) changes.push([PERIOD_KEY, 'period:' + periodId]);
    for (const kind of Object.keys(T.kinds)) {
      if (!T.kinds[kind].owner) continue;
      const old = lastView(data, year, kind);
      const rest = old.startsWith('period:') && old.includes('|') ? old.slice(old.indexOf('|')) : '';
      const view = 'period:' + periodId + rest;
      if (old !== view) changes.push([kind, view]);
    }
    return changes;
  }

  // ---- Άνοιγμα εφαρμογής με στόχο (school-timetables:open) ----
  // Τα Σχολικά Προγράμματα και οι εφαρμογές προγραμμάτων ανοίγουν η μία την άλλη: app = 'programs' (τα Σχολικά
  // Προγράμματα) ή ένα είδος (η εφαρμογή-κάτοχός του), με στόχο {periodId, staffId, classId, day, start}. Η περίοδος του
  // στόχου γίνεται η κοινή τρέχουσα περίοδος· ο στόχος φτάνει στην εφαρμογή μία φορά, στο target του :context της.
  function openTarget(data, year, message, app) {
    if (!sharesPeriod(app)) throw Error('Η εφαρμογή δεν ανοίγει άλλες εφαρμογές προγραμμάτων.');
    const name = message?.app;
    const file = name === 'programs' ? PROGRAMS_APP : known(name) ? T.kinds[name].owner : '';
    if (!file) throw Error('Άγνωστη εφαρμογή προγραμμάτων. Βεβαιώσου ότι η εφαρμογή είναι η τελευταία έκδοση.');
    const raw = isObject(message.target) ? message.target : {}, target = {};
    if (raw.periodId != null) {
      if (!isText(raw.periodId, 200) || !yearData(data, year).periods.some(period => isObject(period) && period.id === raw.periodId)) throw Error('Η περίοδος δεν υπάρχει πια. Φόρτωσε ξανά τα στοιχεία.');
      target.periodId = raw.periodId;
    }
    if (isText(raw.staffId, 200) && raw.staffId) target.staffId = raw.staffId;
    if (isText(raw.classId, 200) && raw.classId) target.classId = raw.classId;
    if (Number.isInteger(raw.day) && raw.day >= 1 && raw.day <= 7) target.day = raw.day;
    if (validTime(raw.start)) target.start = raw.start;
    return {file, title: file === PROGRAMS_APP ? PROGRAMS_TITLE : T.kinds[name].ownerTitle || file, target};
  }

  // ---- Ζουμ του πίνακα (timetableSettings) ----
  // Η εφαρμογή-κάτοχος ενός είδους με πίνακα (Ολοήμερος Designer, Ατομικά Προγράμματα) θυμάται το ζουμ της, κοινό για
  // όλα τα σχολικά έτη: timetableSettings = {zoom:{[είδος]: ποσοστό}}, έξω από το timetablesByYear. Όπως το
  // lastViewByYear, δεν μετρά ως αλλαγή δεδομένων (school-timetables:zoom).
  const ZOOM = Object.freeze({min: 30, max: 200, step: 10, fallback: Object.freeze({oloimero: 80}), defaultValue: 100});
  const validZoom = value => Number.isInteger(value) && value >= ZOOM.min && value <= ZOOM.max && value % ZOOM.step === 0;
  function zoom(data, key) {
    const value = isObject(data?.timetableSettings) && isObject(data.timetableSettings.zoom) ? data.timetableSettings.zoom[key] : null;
    return validZoom(value) ? value : (ZOOM.fallback[key] ?? ZOOM.defaultValue);
  }
  function withZoom(data, key, value) {
    const settings = isObject(data?.timetableSettings) ? data.timetableSettings : {};
    const zooms = isObject(settings.zoom) ? settings.zoom : {};
    return {...data, timetableSettings: {...settings, zoom: {...zooms, [key]: value}}};
  }

  // school-timetables:context για μια εφαρμογή: τα προγράμματα περιόδων όλων των γνωστών ειδών. Προγράμματα
  // άγνωστου είδους, ή χωρίς περίοδο, δεν στέλνονται.
  // Μια εφαρμογή που μόνο διαβάζει δεν παίρνει τα Προσχέδια περιόδων και τα προγράμματά τους.
  // Τα Προσχέδια περιόδων ενός παλαιότερου αρχείου μπορεί να έχουν ημερομηνίες: εδώ σβήνονται, και το αρχείο
  // διορθώνεται με την επόμενη αποθήκευση προγραμμάτων.
  function context(data, app, revision) {
    const year = data.school.year, timetables = yearData(data, year), rights = permissions(app);
    const periods = readerOnly(rights) ? T.officialPeriods(timetables.periods) : withoutDraftDates(timetables.periods);
    const periodIds = new Set(periods.map(period => period?.id));
    return clone({
      revision, school: {...data.school}, year,
      staff: staffOf(data, year), teachingHours: hoursOf(data, year), classes: classesOf(data, year),
      periods,
      programs: timetables.programs.filter(program => known(program?.kind) && program.periodId != null && periodIds.has(program.periodId)),
      // The catalog of the Ατομικά Προγράμματα (subjects and Συνενώσεις of the year), for every application.
      individualCatalog: individualCatalog(data, year),
      // For the warnings near the limits: every program of the year (also of unknown kinds).
      programCount: timetables.programs.length,
      // The last design or period this application showed ('' when there is none).
      lastView: viewKey(app) ? lastView(data, year, viewKey(app)) : '',
      // The current period, shared by «Σχολικά Προγράμματα» and the program applications ('' when there is none).
      currentPeriod: sharesPeriod(app) ? currentPeriod(data, year) : '',
      // The zoom of the board of the owner application (common for every school year), and its limits.
      zoom: viewKey(app) ? zoom(data, viewKey(app)) : null,
      zoomLimits: {min: ZOOM.min, max: ZOOM.max, step: ZOOM.step},
      limits: {programs: LIMITS.programs, periods: LIMITS.periods, activities: LIMITS.activities, classes: classLimit(), warnRatio: WARN_RATIO}
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

  // Ένα Προσχέδιο περιόδου δεν έχει ημερομηνίες· τις αποκτά με τον «Ορισμό ως Επίσημης». Παλαιότερα αρχεία μπορεί να
  // έχουν Προσχέδια με ημερομηνίες: εδώ γίνονται κενές. Η λίστα που δίνεται δεν αλλάζει.
  const hasDate = value => value != null && value !== '';
  const withoutDraftDates = periods => (Array.isArray(periods) ? periods : []).map(period =>
    T.isDraftPeriod(period) && (hasDate(period.from) || hasDate(period.to)) ? {...period, from: '', to: ''} : period);

  // Λίστα περιόδων: μορφή, μοναδικά id και όνομα, κατάσταση (Επίσημη ή Προσχέδιο περιόδου), ημερομηνίες μέσα στο
  // σχολικό έτος, διαθέσιμες ώρες Ολοημέρου. Μια Επίσημη χρειάζεται ημερομηνία έναρξης· ένα Προσχέδιο περιόδου δεν
  // έχει ημερομηνίες. Επικαλύψεις, κενό «έως» σε περίοδο που δεν είναι τελευταία κ.λπ. είναι προειδοποιήσεις των
  // εφαρμογών. options.staffIds: τα id του Προσωπικού, για τις διαθέσιμες ώρες Ολοημέρου (χωρίς αυτό δεν ελέγχεται αν
  // υπάρχουν).
  function validatePeriods(periods, year, options = {}) {
    if (!Array.isArray(periods)) throw Error('Η λίστα περιόδων δεν είναι έγκυρη.');
    if (periods.length > LIMITS.periods) throw Error('Η λίστα θα είχε ' + periods.length + ' περιόδους, πάνω από το όριο των ' + LIMITS.periods + ' ανά σχολικό έτος (μαζί με τα Προσχέδια περιόδων). Η αποθήκευση δεν έγινε.');
    const range = D.schoolYear(year), ids = new Set();
    if (!range) throw Error('Το σχολικό έτος ' + quoted(year) + ' δεν είναι έγκυρο.');
    const rangeText = D.format(range.from) + '–' + D.format(range.to);
    periods.forEach((period, index) => {
      const label = 'Η περίοδος ' + (isObject(period) && isText(period.name) && period.name.trim() ? quoted(period.name.trim()) : String(index + 1));
      if (!isObject(period) || !isText(period.id, 200) || !period.id.trim()) throw Error(label + ' δεν έχει έγκυρη ταυτότητα.');
      if (ids.has(period.id)) throw Error('Δύο περίοδοι έχουν την ίδια ταυτότητα.');
      ids.add(period.id);
      if (!isText(period.name, 200) || !period.name.trim()) throw Error('Η περίοδος ' + (index + 1) + ' χρειάζεται όνομα.');
      if (period.status != null && !T.PERIOD_STATUSES.includes(period.status)) throw Error(label + ' έχει άγνωστη κατάσταση. Βεβαιώσου ότι η εφαρμογή είναι η τελευταία έκδοση.');
      if (T.isDraftPeriod(period)) {
        if (hasDate(period.from) || hasDate(period.to)) throw Error(label + ': ένα Προσχέδιο περιόδου δεν έχει ημερομηνίες. Τις αποκτά με τον «Ορισμό ως Επίσημης».');
      } else {
        if (!D.inSchoolYear(period.from, year)) throw Error(label + ' χρειάζεται ημερομηνία έναρξης μέσα στο σχολικό έτος (' + rangeText + ').');
        if (!(period.to === '' || D.inSchoolYear(period.to, year))) throw Error(label + ' χρειάζεται ημερομηνία λήξης μέσα στο σχολικό έτος (' + rangeText + '), ή κενή.');
      }
      if (period.oloimeroHours != null) {
        const hours = period.oloimeroHours;
        if (!isObject(hours) || Object.keys(hours).length > LIMITS.people) throw Error(label + ': οι διαθέσιμες ώρες Ολοημέρου δεν είναι έγκυρες.');
        for (const [id, value] of Object.entries(hours)) {
          if (!id || id.length > 1000 || !integer(value, 0, T.OLOIMERO_HOURS_MAX)) throw Error(label + ': οι διαθέσιμες ώρες Ολοημέρου πρέπει να είναι ακέραιος από 0 έως ' + T.OLOIMERO_HOURS_MAX + '.');
          if (options.staffIds && !options.staffIds.has(id)) throw Error(label + ': διαθέσιμες ώρες Ολοημέρου για εκπαιδευτικό που δεν υπάρχει στο Προσωπικό του σχολικού έτους.');
        }
      }
    });
  }

  // Οι τάξεις στη γραφή των δεδομένων (Τάξεις των κελιών και των Συνενώσεων του Ολοήμερου Designer).
  const GRADES = Object.freeze(['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Στ']);
  // Validators του source, ανά type: validator(source, ctx), ctx: {classIds}. Άγνωστο type γίνεται δεκτό (έχει ήδη
  // ελεγχθεί ως JSON).
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
    // Σχέδιο του Ολοήμερου Designer (βλέπε «Σχέδια του Ολοήμερου Designer» στο _data.js), source.version:2: χωρίς
    // δικά του Τμήματα (departments)· τα κελιά αναφέρονται σε Τάξη, Τμήμα (id των Τμημάτων) ή Συνένωση.
    'oloimero-designer'(source, ctx) {
      const fail = what => { throw Error('τα στοιχεία του Ολοήμερου Designer δεν είναι έγκυρα (' + what + ').'); };
      const slots = T.OLOIMERO_MAX_SLOTS, classIds = ctx.classIds;
      const knownClass = id => isText(id, 200) && !!id && (!classIds || classIds.has(id));
      const grades = value => Array.isArray(value) && value.length <= GRADES.length && value.every(grade => GRADES.includes(grade));
      if (source.version !== 2) fail('version');
      if (source.departments !== undefined) fail('departments');
      const unionIds = new Set();
      if (source.unions != null) {
        if (!Array.isArray(source.unions) || source.unions.length > 500) fail('unions');
        for (const union of source.unions) {
          if (!isObject(union) || !isText(union.id, 200) || !union.id || unionIds.has(union.id) || !isText(union.name, 300) || !union.name.trim()) fail('unions');
          unionIds.add(union.id);
          if (union.grades != null && !grades(union.grades)) fail('unions');
          if (union.classIds != null && !(Array.isArray(union.classIds) && union.classIds.length <= 100 && union.classIds.every(knownClass))) fail('unions: τμήμα που δεν υπάρχει στα «Τμήματα»');
          if (union.subsets != null && !(Array.isArray(union.subsets) && union.subsets.length <= 100 && union.subsets.every(item => isObject(item) && isText(item.name, 300) && item.name.trim() && (item.classId == null || item.classId === '' || knownClass(item.classId))))) fail('unions');
          if (union.otherStudents != null && !textList(union.otherStudents)) fail('unions');
        }
      }
      const cell = item => isObject(item) && (item.type === 'grade' ? GRADES.includes(item.grade) : item.type === 'class' ? knownClass(item.id) : item.type === 'union' && unionIds.has(item.id));
      const students = value => Array.isArray(value) && value.length <= 50 && value.every(cell);
      const place = item => isObject(item) && isText(item.hourId, 200) && integer(item.day, 1, 5) && integer(item.slot, 0, slots - 1) && students(item.students);
      const named = (value, max) => Array.isArray(value) && value.length <= max && value.every(item => isObject(item) && isText(item.id, 200) && isText(item.name, 300));
      for (const key of ['csvName', 'importedAt']) if (source[key] != null && !isText(source[key])) fail(key);
      if (source.design != null && !(isObject(source.design) && Array.isArray(source.design.hours) && source.design.hours.length <= 60 && source.design.hours.every(item => isObject(item) && isText(item.hourId, 200) && integer(item.count, 0, slots) && typeof item.exceptionsEnabled === 'boolean' && Array.isArray(item.dayCounts) && item.dayCounts.length === 5 && item.dayCounts.every(value => integer(value, 0, slots))))) fail('design');
      if (source.teachers != null && !(Array.isArray(source.teachers) && source.teachers.length <= 200 && source.teachers.every(item => isObject(item) && isText(item.name, 300) && (item.staffId == null || isText(item.staffId, 1000)) && (item.color == null || /^#[0-9a-f]{6}$/i.test(String(item.color))) && (item.availableHours == null || integer(item.availableHours, 0, 99))))) fail('teachers');
      if (source.subjects != null && !named(source.subjects, 500)) fail('subjects');
      // Τα κρυφά Τμήματα μπορεί να έχουν id τμήματος που αφαιρέθηκε· αγνοούνται.
      if (source.hidden != null && !(isObject(source.hidden) && (source.hidden.grades == null || grades(source.hidden.grades)) && (source.hidden.classes == null || (Array.isArray(source.hidden.classes) && source.hidden.classes.length <= 100 && source.hidden.classes.every(id => isText(id, 200)))))) fail('hidden');
      if (source.styles != null && !isObject(source.styles)) fail('styles');
      if (source.placements != null && !(isObject(source.placements) && Object.values(source.placements).every(place))) fail('placements');
      if (source.pending != null && !(Array.isArray(source.pending) && source.pending.length <= LIMITS.activities && source.pending.every(item => place(item) && (item.staffId == null || isText(item.staffId, 1000)) && (item.name == null || isText(item.name, 300)) && (item.subjectId == null || isText(item.subjectId, 200))))) fail('pending');
    }
  };

  SOURCE_VALIDATORS.individual = function (source, ctx) {
    const fail = what => { throw Error('τα στοιχεία των Ατομικών Προγραμμάτων δεν είναι έγκυρα (' + what + ').'); };
    const classIds = ctx.classIds, unionIds = ctx.unionIds, staffIds = ctx.staffIds;
    const chip = item => isObject(item) && (item.type === 'grade' ? GRADES.includes(item.grade)
      : item.type === 'class' ? isText(item.id, 200) && !!item.id && (!classIds || classIds.has(item.id))
      : item.type === 'union' && isText(item.id, 200) && !!item.id && (!unionIds || unionIds.has(item.id)));
    const chips = value => Array.isArray(value) && value.length <= 50 && value.every(chip);
    if (source.version !== 1) fail('version');
    if (source.placements != null) {
      if (!isObject(source.placements)) fail('placements');
      for (const place of Object.values(source.placements)) {
        if (!isObject(place) || (place.subjectId != null && !isText(place.subjectId, 200)) || (place.chips != null && !chips(place.chips))) fail('placements');
      }
    }
    if (source.pending != null) {
      if (!Array.isArray(source.pending) || source.pending.length > LIMITS.activities) fail('pending');
      for (const item of source.pending) {
        if (!isObject(item) || !isText(item.staffId, 1000) || (staffIds && !staffIds.has(item.staffId)) || !integer(item.day, 1, 7) || !validTime(item.start) || !validTime(item.end) || item.start >= item.end || !chips(item.chips)) fail('pending');
      }
    }
  };

  // Πλήρης έλεγχος ενός προγράμματος. options: {staffIds:Set, periodIds:Set, classIds:Set, unionIds:Set} (classIds: τα
  // id των Τμημάτων του έτους, μαζί με τα νέα της ίδιας αποθήκευσης· unionIds: οι Συνενώσεις του καταλόγου των
  // Ατομικών Προγραμμάτων, για το source τους).
  // Κάθε πρόγραμμα ανήκει σε περίοδο (δεν υπάρχουν προσχέδια προγραμμάτων χωρίς περίοδο).
  // Ατομικά Προγράμματα (individual): ένας εκπαιδευτικός ανά δραστηριότητα,
  // και subjectFromClasses (με κενό subject) μόνο εδώ.
  function validateProgram(program, options) {
    const {staffIds, periodIds, classIds, unionIds} = options;
    if (!isObject(program) || !isText(program.id, 200) || !program.id.trim()) throw Error('Ένα πρόγραμμα δεν έχει έγκυρη ταυτότητα.');
    const label = 'Το πρόγραμμα ' + programName(program);
    if (program.formatVersion !== 2) throw Error(label + ' έχει ' + (program.formatVersion === 1 ? 'την παλιά μορφή τμημάτων' : 'άγνωστη μορφή') + '. Βεβαιώσου ότι το index.html και η εφαρμογή του προγράμματος είναι η τελευταία έκδοση.');
    if (!known(program.kind)) throw Error('Ένα πρόγραμμα έχει άγνωστο είδος ' + quoted(String(program.kind)) + '.');
    if (program.periodId == null) throw Error(label + ' δεν ανήκει σε περίοδο. Κάθε πρόγραμμα ανήκει σε περίοδο· δεν υπάρχουν πια προσχέδια προγραμμάτων. Βεβαιώσου ότι η εφαρμογή είναι η τελευταία έκδοση.');
    if (!isText(program.periodId, 200) || !periodIds.has(program.periodId)) throw Error(label + ' ανήκει σε περίοδο που δεν υπάρχει.');
    if (program.name != null && !isText(program.name, 300)) throw Error(label + ' έχει μη έγκυρο όνομα.');
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
      for (const key of ['unmatched', 'classes', 'subsets', 'otherStudents']) if (activity[key] != null && !textList(activity[key])) throw Error(where + ': μη έγκυρη λίστα (' + key + ').');
      if (classIds && (activity.classes || []).some(id => !classIds.has(id))) throw Error(where + ': τμήμα που δεν υπάρχει στα «Τμήματα» του σχολικού έτους.');
      if (activity.subjectFromClasses != null) {
        if (program.kind !== 'individual' || typeof activity.subjectFromClasses !== 'boolean') throw Error(where + ': το «μάθημα της τάξης» (subjectFromClasses) υπάρχει μόνο στα Ατομικά Προγράμματα.');
        if (activity.subjectFromClasses && String(activity.subject ?? '') !== '') throw Error(where + ': δραστηριότητα με «μάθημα της τάξης» δεν έχει δικό της μάθημα.');
      }
      if (program.kind === 'individual' && (activity.staff.length !== 1 || (activity.unmatched || []).length)) throw Error(where + ': κάθε δραστηριότητα των Ατομικών Προγραμμάτων έχει ακριβώς έναν εκπαιδευτικό του Προσωπικού.');
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
        try { validator(program.source, {classIds, unionIds, staffIds}); } catch (error) { throw Error(label + ': ' + error.message); }
      }
    }
    if (program.history != null) validateHistory(program.history, label);
    // The initial state (program.initial, see SchoolTimetable.keepInitial): checked like the program itself.
    if (program.initialSetAt != null && (!isText(program.initialSetAt, 100) || Number.isNaN(Date.parse(program.initialSetAt)))) throw Error(label + ' έχει μη έγκυρη ημερομηνία «Ορισμού ως Αρχικής».');
    if (program.initial != null) {
      const initial = program.initial;
      if (!isObject(initial) || !Array.isArray(initial.activities) || (initial.source != null && !isObject(initial.source))) throw Error(label + ': μη έγκυρη αρχική κατάσταση.');
      try { validateProgram(T.initialProgram(program), options); } catch (error) { throw Error('Αρχική κατάσταση: ' + error.message); }
    }
  }
  // The history of a program (program.history, see SchoolTimetable.addHistory): a list of entries {at, type, …},
  // at most SchoolTimetable.HISTORY_LIMIT. Unknown types and fields are kept as they are.
  function validateHistory(history, label) {
    const limit = T.HISTORY_LIMIT || 20;
    if (!Array.isArray(history)) throw Error(label + ': μη έγκυρο Ιστορικό.');
    if (history.length > limit) throw Error(label + ': το Ιστορικό έχει ' + history.length + ' εγγραφές, πάνω από το όριο των ' + limit + '. Βεβαιώσου ότι η εφαρμογή του προγράμματος είναι η τελευταία έκδοση.');
    for (const entry of history) {
      if (!isObject(entry) || !isText(entry.at, 100) || Number.isNaN(Date.parse(entry.at)) || !isText(entry.type, 50) || !entry.type.trim()) throw Error(label + ': μη έγκυρη εγγραφή στο Ιστορικό.');
    }
  }

  // ---- Αποθήκευση ----
  // Εφαρμογή ενός school-timetables:save ({ops, periods, periodHours, newClasses, individualCatalog}) για την εφαρμογή
  // app σε αντίγραφο του data.
  // ops: [{op:'put', program, setInitial} | {op:'delete', id}]· setInitial:true = «Ορισμός ως Αρχική» (βλέπε
  //   SchoolTimetable.setInitial). Σε κάθε put το host κρατά την αρχική κατάσταση (SchoolTimetable.keepInitial): το
  //   initial και το initialSetAt ενός υπάρχοντος προγράμματος δεν αλλάζουν από την εφαρμογή.
  // periodHours: [{periodId, oloimeroHours}] οι διαθέσιμες ώρες Ολοημέρου μιας περιόδου (όλες μαζί· κενό αντικείμενο:
  //   καμία), από τον Ολοήμερο Designer· τα Σχολικά Προγράμματα τις στέλνουν μέσα στο periods.
  // newClasses: τα νέα τμήματα των εισαγωγών (analysis.newClasses), που προστίθενται στα Τμήματα του έτους.
  // Επιστρέφει το νέο data· πετά λάθος χωρίς να αλλάξει τίποτα. Τα ops εφαρμόζονται όλα μαζί ή κανένα.
  function applySave(data, message, app) {
    const year = data.school.year, rights = permissions(app);
    const ops = message?.ops;
    if (!Array.isArray(ops) || ops.length > LIMITS.ops) throw Error('Μη έγκυρο αίτημα αποθήκευσης προγραμμάτων.');
    checkJson(ops, 'Τα προγράμματα');
    const changesPeriods = message.periods !== undefined;
    if (changesPeriods) {
      if (!rights.periods) throw Error('Οι περίοδοι αλλάζουν μόνο από την εφαρμογή «' + PROGRAMS_TITLE + '».');
      checkJson(message.periods, 'Οι περίοδοι');
      validatePeriods(message.periods, year);
    }
    const changesHours = message.periodHours !== undefined;
    if (changesHours) {
      if (!rights.oloimeroHours) throw Error('Οι διαθέσιμες ώρες Ολοημέρου της περιόδου αλλάζουν μόνο από τις εφαρμογές «' + PROGRAMS_TITLE + '» και «' + (T.kinds.oloimero?.ownerTitle || 'Ολοήμερο Designer') + '».');
      checkJson(message.periodHours, 'Οι διαθέσιμες ώρες Ολοημέρου');
      if (!Array.isArray(message.periodHours) || message.periodHours.length > LIMITS.periods || !message.periodHours.every(item => isObject(item) && isText(item.periodId, 200) && isObject(item.oloimeroHours))) throw Error('Μη έγκυρες διαθέσιμες ώρες Ολοημέρου. Βεβαιώσου ότι η εφαρμογή είναι η τελευταία έκδοση.');
    }
    const addsClasses = Array.isArray(message.newClasses) && message.newClasses.length > 0;
    if (message.newClasses != null) checkJson(message.newClasses, 'Τα νέα τμήματα');
    if (addsClasses && !ops.length) throw Error('Τα νέα τμήματα μιας εισαγωγής αποθηκεύονται μόνο μαζί με το πρόγραμμά τους.');
    const changesCatalog = message.individualCatalog !== undefined;
    if (changesCatalog && app === PROGRAMS_APP) {
      // A restore from a backup: only additions to the catalog, and only together with programs.
      checkJson(message.individualCatalog, 'Ο κατάλογος των Ατομικών Προγραμμάτων');
      validateCatalog(message.individualCatalog);
      checkCatalogAdditions(individualCatalog(data, year), message.individualCatalog);
      if (!ops.length) throw Error('Οι προσθήκες στον κατάλογο των Ατομικών Προγραμμάτων αποθηκεύονται μόνο μαζί με τα προγράμματα της επαναφοράς.');
    } else if (changesCatalog) {
      if (!T.kinds.individual?.owner || app !== T.kinds.individual.owner) throw Error('Ο κατάλογος των Ατομικών Προγραμμάτων αλλάζει μόνο από την εφαρμογή «' + (T.kinds.individual?.ownerTitle || 'Ατομικά Προγράμματα') + '».');
      checkJson(message.individualCatalog, 'Ο κατάλογος των Ατομικών Προγραμμάτων');
      validateCatalog(message.individualCatalog);
    }
    if (!ops.length && !changesPeriods && !changesCatalog && !changesHours) throw Error('Δεν υπάρχουν αλλαγές για αποθήκευση.');
    if (!rights.kinds.length) throw Error('Η εφαρμογή δεν έχει δικαίωμα να αλλάξει προγράμματα.');

    const candidate = clone(data), current = yearData(candidate, year);
    // Σε ένα παλαιότερο αρχείο, τα Προσχέδια περιόδων χάνουν εδώ τις ημερομηνίες τους (withoutDraftDates).
    const periods = changesPeriods ? clone(message.periods) : clone(withoutDraftDates(current.periods));
    // The available hours of the Ολοήμερο of a period (period.oloimeroHours): all of them together.
    for (const item of changesHours ? message.periodHours : []) {
      const period = periods.find(entry => isObject(entry) && entry.id === item.periodId);
      if (!period) throw Error('Οι διαθέσιμες ώρες Ολοημέρου αφορούν περίοδο που δεν υπάρχει. Φόρτωσε ξανά τα στοιχεία.');
      if (Object.keys(item.oloimeroHours).length) period.oloimeroHours = clone(item.oloimeroHours);
      else delete period.oloimeroHours;
    }
    if (changesPeriods || changesHours) validatePeriods(periods, year, {staffIds: new Set(staffOf(candidate, year).map(person => person.id))});
    const now = nowIso();
    const before = new Map(current.programs.filter(program => isObject(program) && typeof program.id === 'string').map(program => [program.id, program]));
    const result = new Map(before), touched = new Set(), puts = [];
    const may = kind => rights.kinds.includes(kind);
    // Είδη που η εφαρμογή γράφει χωρίς να είναι δικά της (WRITERS): μόνο προγράμματα περιόδων.
    const periodOnly = kind => may(kind) && !rights.owned.includes(kind) && rights.app !== PROGRAMS_APP;

    for (const op of ops) {
      if (!isObject(op) || (op.op !== 'put' && op.op !== 'delete') || (op.setInitial != null && typeof op.setInitial !== 'boolean')) throw Error('Μη έγκυρη ενέργεια στα προγράμματα.');
      const id = op.op === 'put' ? op.program?.id : op.id;
      if (!isText(id, 200) || !id) throw Error('Ένα πρόγραμμα δεν έχει έγκυρη ταυτότητα.');
      if (touched.has(id)) throw Error('Το ίδιο πρόγραμμα εμφανίζεται δύο φορές στην ίδια αποθήκευση.');
      touched.add(id);
      const existing = before.get(id);
      if (existing && !known(existing.kind)) throw Error('Το πρόγραμμα ' + programName(existing) + ' είναι άγνωστου είδους και δεν αλλάζει από εδώ. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');
      if (existing && !may(existing.kind)) throw Error('Η εφαρμογή δεν μπορεί να αλλάξει το πρόγραμμα ' + programName(existing) + '.');
      if (existing && periodOnly(existing.kind) && op.op === 'delete') throw Error('Η εφαρμογή μπορεί μόνο να αλλάξει το πρόγραμμα ' + programName(existing) + ' μιας περιόδου, όχι να το διαγράψει.');
      if (op.op === 'delete') {
        if (!existing) throw Error('Το πρόγραμμα που ζητήθηκε να διαγραφεί δεν υπάρχει πια. Φόρτωσε ξανά τα στοιχεία.');
        result.delete(id);
        continue;
      }
      const program = clone(op.program);
      if (!known(program.kind)) throw Error('Ένα πρόγραμμα έχει άγνωστο είδος ' + quoted(String(program.kind)) + '.');
      if (!may(program.kind)) throw Error('Η εφαρμογή δεν μπορεί να γράψει προγράμματα του είδους ' + quoted(kindLabel(program.kind)) + '.');
      if (existing && existing.kind !== program.kind) throw Error('Το είδος ενός προγράμματος δεν αλλάζει.');
      // The initial state is kept by the host: an application never changes the stored one.
      T.keepInitial(existing || null, program, {setInitial: op.setInitial === true, now});
      result.set(id, program);
      puts.push(program);
    }

    // Κανόνες του συνόλου: κανένα πρόγραμμα σε περίοδο που δεν υπάρχει, ένα πρόγραμμα ανά είδος και περίοδο.
    const periodIds = new Set(periods.map(period => period.id));
    const slots = new Map();
    for (const program of result.values()) {
      if (!known(program?.kind) || program.periodId == null) continue;
      if (!periodIds.has(program.periodId)) {
        const removed = current.periods.find(period => period.id === program.periodId);
        throw Error(removed
          ? 'Η περίοδος ' + quoted(removed.name) + ' αφαιρείται, αλλά το πρόγραμμα ' + programName(program) + ' μένει σε αυτήν. Τα προγράμματα της περιόδου διαγράφονται στην ίδια αποθήκευση.'
          : 'Το πρόγραμμα ' + programName(program) + ' ανήκει σε περίοδο που δεν υπάρχει.');
      }
      const key = program.kind + '\u0000' + program.periodId;
      if (slots.has(key)) {
        const period = periods.find(item => item.id === program.periodId);
        throw Error('Η περίοδος ' + quoted(period?.name || '') + ' έχει ήδη πρόγραμμα του είδους ' + quoted(kindLabel(program.kind)) + '. Κάθε περίοδος έχει το πολύ ένα πρόγραμμα ανά είδος.');
      }
      slots.set(key, program.id);
    }
    if (result.size > LIMITS.programs) throw Error('Το σχολικό έτος θα είχε ' + result.size + ' προγράμματα , πάνω από το όριο των ' + LIMITS.programs + '. Η αποθήκευση δεν έγινε. Διάγραψε περιόδους ή προγράμματα που δεν χρειάζονται και ξαναδοκίμασε.');

    // Νέα τμήματα των εισαγωγών: στα Τμήματα του έτους, με τους ελέγχους του _host_classes.js.
    if (addsClasses) {
      if (!hostClasses()) throw Error('Λείπει το αρχείο _host_classes.js από τον φάκελο των εφαρμογών. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
      hostClasses().addClasses(candidate, year, message.newClasses, app);
    } else if (message.newClasses != null && !Array.isArray(message.newClasses)) throw Error('Μη έγκυρη λίστα νέων τμημάτων. Βεβαιώσου ότι το ' + app + ' είναι η τελευταία έκδοση.');
    // Πλήρης έλεγχος μόνο στα προγράμματα που αλλάζουν.
    const staffIds = new Set(staffOf(candidate, year).map(person => person.id));
    const classIds = new Set(classesOf(candidate, year).map(item => item.id));
    const catalog = changesCatalog ? clone(message.individualCatalog) : individualCatalog(candidate, year);
    const unionIds = new Set(catalog.unions.filter(isObject).map(union => union.id));
    // A new catalog is checked against every program of the Ατομικά Προγράμματα (a removed Συνένωση may be in use).
    const checked = changesCatalog ? [...new Set([...puts, ...[...result.values()].filter(program => program?.kind === 'individual')])] : puts;
    for (const program of checked) validateProgram(program, {staffIds, periodIds, classIds, unionIds});

    // Η σειρά των προγραμμάτων μένει ίδια· τα νέα μπαίνουν στο τέλος.
    const programs = [...current.programs.filter(program => !isObject(program) || typeof program.id !== 'string' || result.has(program.id)).map(program => isObject(program) && typeof program.id === 'string' ? result.get(program.id) : program),
      ...[...result.values()].filter(program => !before.has(program.id))];
    if (!isObject(candidate.timetablesByYear)) candidate.timetablesByYear = {};
    candidate.timetablesByYear[year] = {...current, periods, programs, ...(changesCatalog ? {individualCatalog: catalog} : {})};
    return candidate;
  }

  // ---- Προσωπικό ----
  // Σε ποια προγράμματα του έτους εμφανίζεται κάθε εκπαιδευτικός, και στην αρχική τους κατάσταση (με 0 δραστηριότητες
  // όταν είναι μόνο εκεί): {[id]: [{programId, kind, kindLabel, name, periodId, periodName, activities}]}.
  function staffUsage(data, year) {
    const timetables = yearData(data, year), usage = {};
    const periodName = id => timetables.periods.find(period => period.id === id)?.name || '';
    for (const program of timetables.programs) {
      if (!Array.isArray(program?.activities)) continue;
      const counts = new Map();
      for (const activity of program.activities) for (const id of new Set(Array.isArray(activity?.staff) ? activity.staff : [])) counts.set(id, (counts.get(id) || 0) + 1);
      for (const activity of Array.isArray(program.initial?.activities) ? program.initial.activities : []) for (const id of Array.isArray(activity?.staff) ? activity.staff : []) if (!counts.has(id)) counts.set(id, 0);
      for (const item of Array.isArray(program.initial?.source?.pending) ? program.initial.source.pending : []) if (program.kind === 'individual' && item?.staffId && !counts.has(item.staffId)) counts.set(item.staffId, 0);
      for (const [id, activities] of counts) (usage[id] ||= []).push({programId: program.id, kind: program.kind, kindLabel: kindLabel(program.kind), name: program.name || '', periodId: program.periodId ?? null, periodName: periodName(program.periodId), activities});
    }
    return usage;
  }
  const usageText = list => list.map(item => item.kindLabel + ' – ' + (item.periodName || 'περίοδος') + (item.name ? ' ' + quoted(item.name) : '')).join(', ');

  // Αναφορές στα προγράμματα όταν το Προσωπικό διαγράφει εκπαιδευτικούς (στο data, που είναι ήδη αντίγραφο).
  //   before / after: το Προσωπικό του έτους πριν και μετά· removals: [{id, mode:'unmatch'|'remove'}].
  //   unmatch: το id φεύγει από το staff και στο unmatched μπαίνει το shortName του.
  //   remove: το id φεύγει, και σβήνονται οι δραστηριότητες που έμειναν χωρίς ανθρώπους από αυτή τη διαγραφή.
  //   Ατομικά Προγράμματα (individual): οι δραστηριότητες και τα ελλιπή κελιά του εκπαιδευτικού σβήνονται πάντα, και
  //   με unmatch, γιατί ένα ατομικό πρόγραμμα είναι πάντα το πρόγραμμα ενός εκπαιδευτικού του Προσωπικού.
  //   Ισχύει για όλα τα προγράμματα του έτους, και στην αρχική τους κατάσταση (program.initial).
  //   Οι διαθέσιμες ώρες Ολοημέρου των περιόδων του εκπαιδευτικού σβήνονται. Τα source.teachers (FET, Ολοήμερο
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
    // One state of a program (the current one, or the initial one): activities and source. count: the summary counts
    // only the current state. → true when something changed.
    const applyTo = (program, state, count) => {
      let changed = false;
      const source = isObject(state.source) ? state.source : null;
      if (program.kind === 'individual') {
        state.activities = state.activities.filter(activity => {
          if (!Array.isArray(activity?.staff) || !activity.staff.some(id => removedIds.has(id))) return true;
          changed = true;
          if (count) { summary.activities++; summary.removedActivities++; }
          if (isObject(source?.placements)) delete source.placements[activity.id];
          return false;
        });
        if (Array.isArray(source?.pending)) {
          const kept = source.pending.filter(item => !removedIds.has(item?.staffId));
          if (kept.length !== source.pending.length) { source.pending = kept; changed = true; }
        }
        return changed;
      }
      if (targets.size) state.activities = state.activities.filter(activity => {
        if (!Array.isArray(activity?.staff) || !activity.staff.some(id => targets.has(id))) return true;
        changed = true;
        if (count) summary.activities++;
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
        if (empty && hits.some(id => targets.get(id).mode === 'remove')) { if (count) summary.removedActivities++; return false; }
        return true;
      });
      if (Array.isArray(source?.teachers)) for (const teacher of source.teachers) {
        if (isObject(teacher) && removedIds.has(teacher.staffId)) { teacher.staffId = null; changed = true; }
      }
      return changed;
    };
    for (const program of data.timetablesByYear[year].programs || []) {
      if (!Array.isArray(program?.activities)) continue;
      let changed = applyTo(program, program, true);
      if (isObject(program.initial) && Array.isArray(program.initial.activities) && applyTo(program, program.initial, false)) {
        changed = true;
        // The initial state may now be the same as the current one.
        if (T.programState(T.initialProgram(program)) === T.programState(program)) delete program.initial;
      }
      if (changed) { program.updatedAt = at; summary.programs++; }
    }
    // The available hours of the Ολοήμερο of the periods of the deleted teachers.
    for (const period of Array.isArray(data.timetablesByYear[year].periods) ? data.timetablesByYear[year].periods : []) {
      if (!isObject(period?.oloimeroHours)) continue;
      for (const id of removedIds) delete period.oloimeroHours[id];
      if (!Object.keys(period.oloimeroHours).length) delete period.oloimeroHours;
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

  // The backup of a period (JSON, SchoolTimetable.periodBackup), saved where the user chooses: {action:'backupSave',
  // suggestedName, text} → {name}. «Σχολικά Προγράμματα», the Ολοήμερο Designer and the Ατομικά Προγράμματα offer it
  // before an action that changes or removes stored programs (schoolBackupConfirm of _ui.js); the picker starts in the
  // folder of the last backup of the school year, the same for all of them.
  const BACKUP_FILE = {description: 'Αντίγραφο ασφαλείας περιόδου (Σχολικά Προγράμματα)', accept: {'application/json': ['.json']}};
  const backupKey = year => 'programs-backup:' + year;
  async function saveBackup(year, message) {
    if (typeof message.text !== 'string' || message.text.length > EXPORT_MAX_CHARS) throw Error('Τα δεδομένα του αντιγράφου ασφαλείας δεν είναι έγκυρα.');
    const name = String(message.suggestedName || 'programs_backup.json').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 200) || 'programs_backup.json';
    const handle = await picker('save', {id: 'sp-backup', suggestedName: name, types: [BACKUP_FILE]}, await rememberedHandle(backupKey(year)));
    const writer = await handle.createWritable();
    try { await writer.write(new Blob([message.text], {type: 'application/json;charset=utf-8'})); await writer.close(); }
    catch (error) { await writer.abort().catch(() => {}); throw error; }
    await referenceStore('put', backupKey(year), handle).catch(() => {});
    return {name: handle.name};
  }

  // The files of «Σχολικά Προγράμματα» (school-programs:file):
  //   {action:'last'|'read'|'choose', kind, importer, file}  the file of an importer (importFile)
  //   {action:'backupSave', suggestedName, text}            saves the backup of a period (saveBackup) → {name}
  //   {action:'backupOpen'}                                  a backup file chosen by the user → {name, text}
  async function programsFile(year, message, app) {
    if (app !== undefined && app !== PROGRAMS_APP) throw Error('Τα αρχεία των «' + PROGRAMS_TITLE + '» τα ζητά μόνο η εφαρμογή ' + quoted(PROGRAMS_TITLE) + '.');
    if (message?.action === 'backupSave') return saveBackup(year, message);
    if (message?.action === 'backupOpen') return rememberedFile('choose', {key: backupKey(year), pickerId: 'sp-backup', ...BACKUP_FILE});
    return importFile(year, message, app);
  }

  // The files of the Ατομικά Προγράμματα (school-individual:file): only {action:'backupSave', suggestedName, text}, the
  // backup of a period (saveBackup) → {name}.
  async function individualFile(year, message, app) {
    const owner = T.kinds.individual.owner;
    if (app !== undefined && app !== owner) throw Error('Τα αρχεία των Ατομικών Προγραμμάτων τα ζητά μόνο η εφαρμογή ' + quoted(T.kinds.individual.ownerTitle) + '.');
    if (message?.action === 'backupSave') return saveBackup(year, message);
    throw Error('Άγνωστη ενέργεια αρχείου. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.');
  }

  // The files of the Ολοήμερο Designer (school-oloimero:file):
  //   {action:'last'|'read'|'choose', kind:'oloimero', importer, file}  the file of an importer (importFile)
  //   {action:'last'|'read'|'choose', reference:'fet'}                 a .fet file for the Μαθήματα and Τμήματα of
  //                                                                    the sidebar; remembered per school year
  //   {action:'export', suggestedName, text}                           saves the CSV for FET → {name}; the picker
  //                                                                    starts in the folder of the last export
  //   {action:'backupSave', suggestedName, text}                       saves the backup of a period (saveBackup)
  async function oloimeroFile(year, message, app) {
    const owner = T.kinds.oloimero.owner;
    if (app !== undefined && app !== owner) throw Error('Τα αρχεία του Ολοήμερου Designer τα ζητά μόνο ο ' + quoted(T.kinds.oloimero.ownerTitle) + '.');
    if (message?.action === 'backupSave') return saveBackup(year, message);
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
  //   activity()             μηδενίζει το ρολόι αδράνειας,
  //   view(year, key, view)  νέα τελευταία επιλογή (lastViewByYear), χωρίς αλλαγή δεδομένων,
  //   open(file, title)      Promise: ανοίγει μια εφαρμογή (με την ερώτηση για μη αποθηκευμένες αλλαγές)· → true όταν
  //                          άνοιξε,
  //   zoom(key, value)       νέο ζουμ του πίνακα (timetableSettings), χωρίς αλλαγή δεδομένων
  // }
  // Αιτήματα αρχείων, ανά τύπο μηνύματος: η εφαρμογή που τα στέλνει και η συνάρτηση που τα εξυπηρετεί.
  const FILE_REQUESTS = {
    'school-programs:file': {app: () => PROGRAMS_APP, run: programsFile},
    'school-fet:file': {app: () => T.kinds.school.owner, run: importFile},
    'school-oloimero:file': {app: () => T.kinds.oloimero.owner, run: oloimeroFile},
    'school-individual:file': {app: () => T.kinds.individual.owner, run: individualFile}
  };
  function install(bridge) {
    let fileBusy = false;
    // The target of an application opened by school-timetables:open: given once, in the :context of its :ready.
    let pending = null;
    // A new shared current period: kept by the index like the last selection (school-timetables:view).
    const setCurrentPeriod = (data, periodId) => {
      const year = data.school.year;
      for (const [key, view] of periodViews(data, year, periodId)) bridge.view?.(year, key, view);
    };
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
        if (!state.data) return;
        const value = context(state.data, app, state.revision);
        if (pending?.file === app) value.target = clone(pending.target);
        pending = null;
        reply({type: 'school-timetables:context', context: value});
        return;
      }
      // The user chose another period: it becomes the current period of every program application.
      if (message.type === 'school-timetables:period') {
        if (!state.data || !sharesPeriod(app) || !isText(message.periodId, 200)) return;
        if (!yearData(state.data, state.data.school.year).periods.some(period => isObject(period) && period.id === message.periodId)) return;
        setCurrentPeriod(state.data, message.periodId);
        return;
      }
      // Open another program application, with a target (period, teacher, τμήμα, day, hour).
      if (message.type === 'school-timetables:open') {
        if (!state.data || state.busy || !bridge.open) return;
        let spec;
        try { spec = openTarget(state.data, state.data.school.year, message, app); } catch { return; }
        if (spec.file === app) return;
        bridge.activity?.();
        if (spec.target.periodId) setCurrentPeriod(bridge.state().data, spec.target.periodId);
        pending = {file: spec.file, target: spec.target};
        let opened = false;
        try { opened = await bridge.open(spec.file, spec.title); } catch { opened = false; }
        if (!opened && pending?.file === spec.file) pending = null;
        return;
      }
      // The selection of the application changed: the index keeps it, without marking any change of data.
      if (message.type === 'school-timetables:view') {
        const key = viewKey(app);
        if (!state.data || !key || typeof message.view !== 'string' || !VIEW_PATTERN.test(message.view)) return;
        if (lastView(state.data, state.data.school.year, key) !== message.view) bridge.view?.(state.data.school.year, key, message.view);
        return;
      }
      // The zoom of the board changed: kept like the last selection, for every school year.
      if (message.type === 'school-timetables:zoom') {
        const key = viewKey(app);
        if (!state.data || !key || !validZoom(message.zoom)) return;
        if (zoom(state.data, key) !== message.zoom) bridge.zoom?.(key, message.zoom);
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
    PROGRAMS_APP, PROGRAMS_TITLE, LIMITS, WARN_RATIO, CATALOG_LIMITS, permissions, yearData, individualCatalog, validateCatalog, checkCatalogAdditions, context,
    validatePeriods, withoutDraftDates, validateProgram, applySave, viewKey, lastView, withView, currentPeriod, periodViews, openTarget, ZOOM, zoom, withZoom,
    staffUsage, applyStaffRemovals, importFile, programsFile, oloimeroFile, individualFile, droppedImportFile, rememberedFile, install
  });
})();
