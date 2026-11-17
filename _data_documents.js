/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων: πεδία εγγράφων
 * Έκδοση αρχείου: 0.02
 * Όνομα κατά την εγκατάσταση: _data_documents.js
 *
 * Ο κοινός κώδικας δεδομένων είναι σε τέσσερα αρχεία, που φορτώνονται πάντα όλα, με αυτή τη σειρά, μετά το _ui.js
 * και πριν από το δικό τους script (στο index πριν από τα _host_*.js):
 *   <script src="_data.js"></script>
 *   <script src="_data_timetable.js"></script>
 *   <script src="_data_oloimero.js"></script>
 *   <script src="_data_documents.js"></script>
 * Δεν έχουν δικό τους περιβάλλον χρήστη: δεν ανοίγουν διαλόγους και δεν γράφουν στη σελίδα. Κάθε αρχείο ελέγχει ότι
 * φορτώθηκαν πριν από αυτό τα προηγούμενα, και αλλιώς σταματά με μήνυμα που λέει ποιο λείπει.
 * Χρειάζεται τα _data.js, _data_timetable.js και _data_oloimero.js.
 * Ορίζει:
 *   window.SchoolDocumentFields  πεδία από το κοινό αρχείο για τα πρότυπα του Documents Templater ({{@…}}):
 *                           κατάλογος, αναγνώριση και υποδείξεις, αν ένα πεδίο χρειάζεται περίοδο, άγκυρες, είδος προτύπου, τιμές για
 *                           εκπαιδευτικό ή τμήμα σε μια περίοδο, έτοιμος πίνακας του πλέγματος και των μαθημάτων, ονόματα εγγράφων
 */
(() => {
  'use strict';
  const parts = window.SchoolDataParts;
  if (!parts) throw Error('Λείπει το αρχείο _data.js, που φορτώνεται πριν από το _data_documents.js. Βεβαιώσου ότι η σελίδα φορτώνει τα _data.js, _data_timetable.js, _data_oloimero.js και _data_documents.js, με αυτή τη σειρά, και ότι είναι η τελευταία έκδοση.');
  parts.needs('_data_documents.js', ['_data.js', '_data_timetable.js', '_data_oloimero.js']);
  const {compareKey, formatDate, today, unique, quoted, isObject, timedHours, periodEnd, GRADES, gradeName,
    gradeIndex, isGeneralClass, sortClasses, classesById, studentsText, activitySubject, sameKey,
    OLOIMERO_CATEGORIES, OLOIMERO_MAX_SLOTS, sortStaff, composePeriod} = parts;

  // ---- Πεδία εγγράφων (Documents Templater) ----
  // Τα πεδία από το κοινό αρχείο γράφονται στα πρότυπα με «@» στην αρχή: {{@Σχολείο}}, {{@Εκπ.Πρ.Δε.1}}.
  // Χωρίς «@» ένα πεδίο είναι πάντα χειροκίνητο. Ο κατάλογος γράφεται με «οικογένειες» πεδίων (στατικά, ώρες,
  // πλέγμα, σύνολα, μαθήματα), ώστε να προστίθενται εύκολα νέα. Ο τύπος κάθε πεδίου είναι γραμμένος εδώ·
  // το «:Integer» / «:Date» στο πρότυπο είναι προαιρετικό. Πρόγραμμα είναι η σύνθεση της περιόδου (composePeriod):
  // το Πρωινό από το Ωρολόγιο, οι ζώνες Ολοημέρου από το σχέδιο Ολοημέρου (ή από το Ωρολόγιο, όταν η περίοδος δεν
  // έχει σχέδιο) και τα Ατομικά Προγράμματα. Ένας εκπαιδευτικός έχει όλες τις δραστηριότητές του· ένα τμήμα μόνο τα
  // μαθήματά του, χωρίς τις δραστηριότητες στήριξης (τα Ατομικά Προγράμματα). Από το σχέδιο Ολοημέρου παίρνεται και
  // η θέση των δραστηριοτήτων (Τμήματα Ολοημέρου). Τα πεδία του προγράμματος χρειάζονται Ωρολόγιο στην περίοδο.
  const DOC_MARK = '@';
  const DOC_DAYS = Object.freeze([['Δε', 1, 'Δευτέρα'], ['Τρ', 2, 'Τρίτη'], ['Τε', 3, 'Τετάρτη'], ['Πε', 4, 'Πέμπτη'], ['Πα', 5, 'Παρασκευή']]
    .map(([key, day, label]) => Object.freeze({key, day, label})));
  // Ζώνες για τα σύνολα ωρών. Το Ολοήμερο και το Διευρυμένο μετρούν χωριστά, από την κατηγορία της ώρας.
  const DOC_ZONES = Object.freeze([['ΠΖ', 'Πρωινή Ζώνη', 'early'], ['Πρωινό', 'Πρωινό', 'morning'], ['Γεύμα', 'Γεύμα', 'meal'], ['Ολοήμερο', 'Ολοήμερο', 'afternoon'], ['Διευρυμένο', 'Διευρυμένο', 'extended']]
    .map(([key, label, category]) => Object.freeze({key, label, category})));
  // Αρίθμηση των ωρών του πλέγματος ανά ζώνη, όπως οι ετικέτες FET: ΠΖ1…, 1…6, ΓΕΥΜΑ1…, ΟΛΟ1… (κοινή για
  // Ολοήμερο και Διευρυμένο). Ποτέ μία αρίθμηση για όλη τη μέρα.
  const DOC_SLOT_PREFIX = Object.freeze({early: 'ΠΖ', morning: '', meal: 'ΓΕΥΜΑ', afternoon: 'ΟΛΟ', extended: 'ΟΛΟ'});
  const DOC_ROLE_LABELS = Object.freeze({teacher: 'Εκπαιδευτικός', director: 'Διευθυντής', deputy: 'Υποδιευθυντής'});
  const DOC_SERVICE_LABELS = Object.freeze({
    classroom: 'Δάσκαλος', specialty: 'Ειδικότητα', inclusion: 'Ειδική Αγωγή – Τμήμα Ένταξης', parallel: 'Ειδική Αγωγή – Παράλληλη Στήριξη',
    zep: 'ΖΕΠ – Τμήμα Υποδοχής', oloimero: 'Υπεύθυνος Ολοημέρου', psychologist: 'ΕΕΠ – Ψυχολόγος', socialWorker: 'ΕΕΠ – Κοινωνικός Λειτουργός',
    nurse: 'ΕΕΠ – Σχολικός Νοσηλευτής', ebp: 'Ειδικό Βοηθητικό Προσωπικό (ΕΒΠ)', other: 'Άλλο'
  });
  const DOC_SCOPES = Object.freeze({common: 'common', staff: 'staff', class: 'class'});
  const docTime = (start, end) => start + '–' + end;
  const docNumber = value => Number.isFinite(Number(value)) && String(value ?? '').trim() !== '' ? String(Number(value)) : '';
  const docJoin = (list, separator) => unique(list.map(item => String(item ?? '').trim()).filter(Boolean)).join(separator);
  // Το όνομα του σχολείου μπορεί να έχει <sup> (π.χ. «1<sup>o</sup> ΔΣ»): στα έγγραφα γράφεται ως απλό κείμενο.
  const docPlain = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

  // Οι ώρες του πλέγματος από τις Ώρες Διδασκαλίας → {slots:[{key, category, zone, start, end, time}],
  // rows:[{type:'slot', slot} | {type:'break', start, end, time}]} με τη σειρά των Ωρών Διδασκαλίας.
  // Πετά λάθος, όπως το timedHours, για ώρα χωρίς «HH:MM-HH:MM».
  function docSlots(teachingHours) {
    const counters = {}, slots = [], rows = [];
    for (const item of timedHours(teachingHours)) {
      const time = docTime(item.start, item.end);
      if (item.category === 'break') { rows.push({type: 'break', start: item.start, end: item.end, time}); continue; }
      const prefix = DOC_SLOT_PREFIX[item.category];
      if (prefix === undefined) continue;
      const counter = prefix || 'morning';
      counters[counter] = (counters[counter] || 0) + 1;
      const zone = DOC_ZONES.find(zoneItem => zoneItem.category === item.category).key;
      const slot = {key: prefix + counters[counter], category: item.category, zone, start: item.start, end: item.end, time};
      slots.push(slot); rows.push({type: 'slot', slot});
    }
    return {slots, rows};
  }

  // Στατικά πεδία. get(c, target): c το context του docContext, target ο εκπαιδευτικός ή το τμήμα.
  const staffName = (c, id) => { const person = c.staffById.get(id); return person ? String(person.name || person.shortName || '') : ''; };
  const DOC_COMMON = Object.freeze([
    {name: 'Σχολείο', type: 'Text', help: 'Το όνομα του σχολείου.', example: '1ο Δημοτικό Σχολείο', get: c => c.schoolName},
    {name: 'Σχολικό Έτος', type: 'Text', help: 'Το σχολικό έτος του κοινού αρχείου.', example: '2026-2027', get: c => c.year},
    {name: 'Περίοδος', type: 'Text', period: true, help: 'Το όνομα της επιλεγμένης περιόδου.', example: 'Α περίοδος', get: c => String(c.period?.name ?? '')},
    {name: 'Περίοδος Από', type: 'Date', period: true, help: 'Η έναρξη της περιόδου.', example: '01/09/2026', get: c => c.period ? formatDate(c.period.from) : ''},
    {name: 'Περίοδος Έως', type: 'Date', period: true, help: 'Η λήξη της περιόδου· χωρίς «έως», η 15η Ιουνίου.', example: '15/06/2027', get: c => c.period ? formatDate(periodEnd(c.period, c.year)) : ''},
    {name: 'Διευθυντής', type: 'Text', help: 'Το πλήρες όνομα του διευθυντή (Ιδιότητα «Διευθυντής» στο Προσωπικό).', example: 'Γεωργίου Ελένη', get: c => docJoin(c.sortedStaff.filter(person => person.role === 'director').map(person => person.name), ', ')},
    {name: 'Υποδιευθυντής', type: 'Text', help: 'Το πλήρες όνομα του υποδιευθυντή (Ιδιότητα «Υποδιευθυντής»).', example: 'Νικολάου Γιώργος', get: c => docJoin(c.sortedStaff.filter(person => person.role === 'deputy').map(person => person.name), ', ')},
    {name: 'Σήμερα', type: 'Date', help: 'Η ημερομηνία παραγωγής των εγγράφων.', example: '11/11/2026', get: c => formatDate(c.today)}
  ].map(Object.freeze));
  const DOC_STAFF = Object.freeze([
    {name: 'Ονοματεπώνυμο', type: 'Text', help: 'Το πλήρες όνομα από το Προσωπικό.', example: 'Μάρκου Παρασκευή', get: (c, p) => String(p.name ?? '')},
    {name: 'Σύντομο Όνομα', type: 'Text', help: 'Το σύντομο όνομα (όπως στο FET).', example: '[Α1] - Δασκάλα', get: (c, p) => String(p.shortName ?? '')},
    {name: 'Κωδικός', type: 'Text', help: 'Ο κωδικός (όπως στο FET).', example: 'Α1', get: (c, p) => String(p.code ?? '')},
    {name: 'Κλάδος', type: 'Text', help: 'Ο κλάδος.', example: 'ΠΕ70', get: (c, p) => String(p.branch ?? '')},
    {name: 'Ιδιότητα', type: 'Text', help: 'Εκπαιδευτικός, Διευθυντής ή Υποδιευθυντής.', example: 'Εκπαιδευτικός', get: (c, p) => DOC_ROLE_LABELS[p.role] || ''},
    {name: 'Είδος Υπηρεσίας', type: 'Text', help: 'Το είδος υπηρεσίας από το Προσωπικό.', example: 'Δάσκαλος', get: (c, p) => DOC_SERVICE_LABELS[p.serviceType] || ''},
    {name: 'Υποχρεωτικό Ωράριο', type: 'Integer', help: 'Το «Υποχρεωτικό ωράριο» του Προσωπικού.', example: '24', get: (c, p) => docNumber(p.requiredHours)},
    {name: 'Ωράριο Σχολείου', type: 'Integer', help: 'Το «Ωράριο στο σχολείο» του Προσωπικού.', example: '24', get: (c, p) => docNumber(p.schoolHours)},
    {name: 'Ανάληψη Υπηρεσίας', type: 'Date', help: 'Η ημερομηνία ανάληψης υπηρεσίας.', example: '01/09/2026', get: (c, p) => formatDate(p.startDate)},
    {name: 'Αποχώρηση', type: 'Date', help: 'Η ημερομηνία αποχώρησης (κενό αν δεν υπάρχει).', example: '', get: (c, p) => formatDate(p.endDate)},
    {name: 'Υπεύθυνος Τμήματος', type: 'Text', help: 'Το τμήμα του οποίου είναι υπεύθυνος στα «Τμήματα».', example: 'Α1', get: (c, p) => docJoin(c.classes.filter(record => record.homeroomStaffId && record.homeroomStaffId === p.id).map(record => record.name), ', ')}
  ].map(Object.freeze));
  const DOC_CLASS = Object.freeze([
    {name: 'Όνομα', type: 'Text', help: 'Το όνομα του τμήματος από τα «Τμήματα».', example: 'Α1', get: (c, r) => String(r.name ?? '')},
    {name: 'Τάξη', type: 'Text', help: 'Η τάξη, χωρίς απόστροφο (κενό σε τμήμα που δεν είναι Γενικής Παιδείας).', example: 'Α', get: (c, r) => isGeneralClass(r) ? gradeName(GRADES[gradeIndex(r.grade)]) : ''},
    {name: 'Υπεύθυνος', type: 'Text', help: 'Το πλήρες όνομα του υπευθύνου στα «Τμήματα».', example: 'Μάρκου Παρασκευή', get: (c, r) => r.homeroomStaffId ? staffName(c, r.homeroomStaffId) : ''},
    {name: 'Αριθμός Μαθητών', type: 'Integer', help: 'Πόσους μαθητές έχει το τμήμα στους «Μαθητές».', example: '18', get: (c, r) => String(Number(c.studentCounts[r.id]) || 0)}
  ].map(Object.freeze));
  // Τα στοιχεία του υπευθύνου ενός τμήματος ({{@Τμ.Υπεύθυνος.…}}): τα στατικά πεδία εκπαιδευτικού, εκτός από το «Υπεύθυνος Τμήματος».
  const DOC_HOMEROOM = Object.freeze(DOC_STAFF.filter(field => field.name !== 'Υπεύθυνος Τμήματος'));
  // Η άγκυρα ({{@Εκπ.Άγκυρα}}, {{@Τμ.Άγκυρα}}): γράφει πάντα κενό και σημειώνει μια θέση σε πρότυπο XLSX με άγκυρες.
  const DOC_ANCHOR_NAME = 'Άγκυρα';
  const DOC_STAFF_VARIANTS = Object.freeze(['Μάθημα', 'Τμήμα', 'Τάξη', 'Αίθουσα']);
  const DOC_CLASS_VARIANTS = Object.freeze(['Μάθημα', 'Εκπαιδευτικός', 'Εκπαιδευτικός Σύντομο', 'Αίθουσα']);
  const DOC_SCOPE_PREFIX = Object.freeze({staff: 'Εκπ', class: 'Τμ'});
  // Τμήματα Ολοημέρου ({{@Ολ.Πρ.Δε.ΟΛΟ2.Τμ1}}): μόνο οι ώρες του Ολοημέρου (ΠΖ…, ΓΕΥΜΑ…, ΟΛΟ…), τα τμήματα Τμ1…Τμ20
  // (OLOIMERO_MAX_SLOTS), οι παραλλαγές του πλέγματος τμήματος, και οι εκπαιδευτικοί όλων των τμημάτων της ώρας.
  const DOC_OLOIMERO_PREFIX = 'Ολ';
  const DOC_OLOIMERO_SLOT = /^(ΠΖ|ΓΕΥΜΑ|ΟΛΟ)\d+$/;
  // Of one τμήμα: the variants of the class grid, and the name with the branch in brackets («Όνομα (ΠΕ70)»).
  // The name shows the shape of the value: «Εκπαιδευτικός (Κλάδος)» → «Όνομα (ΠΕ70)».
  const DOC_OLOIMERO_VARIANTS = Object.freeze([...DOC_CLASS_VARIANTS, 'Εκπαιδευτικός (Κλάδος)', 'Εκπαιδευτικός Σύντομο (Κλάδος)']);
  // Of all the τμήματα of the hour: full or short name, without the branch, with it in brackets («Εκπαιδευτικοί (Κλάδος)»
  // → «Όνομα (ΠΕ70)»), or after a comma («Εκπαιδευτικοί, Κλάδος» → «Όνομα, ΠΕ70», only with «.Λίστα», since «.Γραμμή»
  // separates the teachers with «, »).
  const DOC_OLOIMERO_TEACHERS = Object.freeze(['Εκπαιδευτικοί', 'Εκπαιδευτικοί Σύντομο', 'Εκπαιδευτικοί (Κλάδος)', 'Εκπαιδευτικοί Σύντομο (Κλάδος)', 'Εκπαιδευτικοί, Κλάδος', 'Εκπαιδευτικοί Σύντομο, Κλάδος']);
  const docTeacherKind = name => ({short: /Σύντομο/.test(name), branch: /\(Κλάδος\)$/.test(name) ? 'paren' : /, Κλάδος$/.test(name) ? 'comma' : ''});
  const docTeacherForms = teachers => docTeacherKind(teachers).branch === 'comma' ? [DOC_OLOIMERO_FORMS[0]] : DOC_OLOIMERO_FORMS;
  const DOC_OLOIMERO_FORMS = Object.freeze(['Λίστα', 'Γραμμή']);

  // ---- Ανάλυση ονόματος πεδίου ----
  // info: {slotKeys: Set | null, codes: Map(compareKey → κωδικός) | null}. Χωρίς Ώρες Διδασκαλίας ή Ωρολόγιο,
  // οι ώρες και οι κωδικοί δεκτοί όταν απλώς έχουν σωστή μορφή.
  // → {ok:true, name (κανονική γραφή χωρίς «@»), scope, type, spec} ή {ok:false, error}.
  const docOption = (value, options) => options.find(option => compareKey(option) === compareKey(value));
  function docSlotKey(value, info) {
    const key = compareKey(value);
    if (info?.slotKeys) return [...info.slotKeys].find(slot => compareKey(slot) === key) || null;
    return /^(ΠΖ|ΓΕΥΜΑ|ΟΛΟ)?[1-9]\d*$/.test(key) ? key : null;
  }
  function docCode(value, info) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (info?.codes) return info.codes.get(compareKey(text)) || null;
    return text;
  }
  // Lesson codes joined with «+» («ΓΑΛ+ΓΕΡ»), for the fields of hours and teachers: the hours of any of them count.
  // → {code} (canonical, joined with «+») or {error} for an unknown or repeated code.
  function docCodes(value, info) {
    const parts = String(value ?? '').split('+').map(part => part.trim());
    if (parts.length === 1) { const code = docCode(parts[0], info); return code ? {code} : {missing: parts[0]}; }
    const codes = parts.map(part => docCode(part, info));
    const missing = parts[codes.findIndex(code => !code)];
    if (missing !== undefined) return {missing};
    if (new Set(codes.map(compareKey)).size !== codes.length) return {error: 'Ένα μάθημα γράφεται μία φορά στο ' + quoted(value) + '.'};
    return {code: codes.join('+')};
  }
  // The result of one name is the same for the same info (one context), so it is kept: a template or the window
  // «Πεδία» asks for thousands of names, and recognize and values read each of them more than once. Read only.
  const docParseCache = new WeakMap(), docNoInfo = {};
  function docParse(body, info) {
    const holder = info || docNoInfo, key = String(body ?? '');
    if (!docParseCache.has(holder)) docParseCache.set(holder, new Map());
    const cache = docParseCache.get(holder);
    if (!cache.has(key)) cache.set(key, docParseName(body, info));
    return cache.get(key);
  }
  function docParseName(body, info) {
    const text = String(body ?? '').trim();
    const parts = text.split('.').map(part => part.trim());
    const fail = error => ({ok: false, error});
    const unknown = () => fail('Το πεδίο δεν υπάρχει στον κατάλογο. Δες το παράθυρο «Πεδία».');
    const slotError = value => fail('Η ώρα ' + quoted(value) + ' δεν υπάρχει στις Ώρες Διδασκαλίας του έτους.');
    const codeError = value => fail(info?.codes ? 'Ο κωδικός μαθήματος ' + quoted(value) + ' δεν υπάρχει στο Ωρολόγιο της περιόδου.' : 'Λείπει ο κωδικός του μαθήματος.');
    const ok = (name, scope, type, spec) => ({ok: true, name, scope, type, spec});
    const common = DOC_COMMON.find(field => compareKey(field.name) === compareKey(text));
    if (common) return ok(common.name, 'common', common.type, {family: 'static', field: common});
    const head = compareKey(parts[0]), rest = parts.slice(1);
    if (head === 'ΩΡΑ') {
      if (rest.length !== 1) return unknown();
      const slot = docSlotKey(rest[0], info);
      return slot ? ok('Ώρα.' + slot, 'common', 'Text', {family: 'time', slot}) : slotError(rest[0]);
    }
    if (head === 'ΜΑΘΗΜΑ') {
      if (rest.length < 1 || rest.length > 2 || (rest.length === 2 && compareKey(rest[1]) !== 'ΠΛΗΡΕΣ')) return unknown();
      const code = docCode(rest[0], info);
      if (!code) return codeError(rest[0]);
      return ok('Μάθημα.' + code + (rest.length === 2 ? '.Πλήρες' : ''), 'common', 'Text', {family: 'subject', code, full: rest.length === 2});
    }
    if (head === compareKey(DOC_OLOIMERO_PREFIX)) {
      if (rest.length < 4 || rest.length > 6 || compareKey(rest[0]) !== 'ΠΡ') return unknown();
      const day = DOC_DAYS.find(item => compareKey(item.key) === compareKey(rest[1]));
      if (!day) return fail('Η ημέρα ' + quoted(rest[1]) + ' δεν υπάρχει· οι ημέρες είναι Δε, Τρ, Τε, Πε, Πα.');
      const slot = docSlotKey(rest[2], info);
      if (!slot) return slotError(rest[2]);
      if (!DOC_OLOIMERO_SLOT.test(slot)) return fail('Η ώρα ' + quoted(rest[2]) + ' δεν είναι ώρα Ολοημέρου· τα πεδία «Ολ.» δέχονται μόνο ώρες της Πρωινής Ζώνης (ΠΖ…), του Γεύματος (ΓΕΥΜΑ…) και του Ολοημέρου και Διευρυμένου (ΟΛΟ…).');
      const prefix = DOC_OLOIMERO_PREFIX + '.Πρ.' + day.key + '.' + slot + '.';
      const match = /^ΤΜ(\d+)$/.exec(compareKey(rest[3]));
      if (match) {
        const number = Number(match[1]);
        if (number < 1 || number > OLOIMERO_MAX_SLOTS) return fail('Το τμήμα ' + quoted(rest[3]) + ' δεν υπάρχει· τα τμήματα του Ολοημέρου είναι Τμ1 έως Τμ' + OLOIMERO_MAX_SLOTS + '.');
        // The details of the teacher of the τμήμα from Προσωπικό: «Τμ1.Εκπαιδευτικός.Κλάδος».
        if (rest.length === 6 && compareKey(rest[4]) === compareKey('Εκπαιδευτικός')) {
          const field = DOC_STAFF.find(item => compareKey(item.name) === compareKey(rest[5]));
          if (!field) return unknown();
          return ok(prefix + 'Τμ' + number + '.Εκπαιδευτικός.' + field.name, 'common', field.type, {family: 'oloimero', day, slot, number, field});
        }
        if (rest.length > 5) return unknown();
        const variant = rest.length === 5 ? docOption(rest[4], DOC_OLOIMERO_VARIANTS) : '';
        if (variant === undefined) return unknown();
        return ok(prefix + 'Τμ' + number + (variant ? '.' + variant : ''), 'common', 'Text', {family: 'oloimero', day, slot, number, variant});
      }
      if (rest.length > 5) return unknown();
      const teachers = docOption(rest[3], DOC_OLOIMERO_TEACHERS), form = rest.length === 5 ? docOption(rest[4], DOC_OLOIMERO_FORMS) : undefined;
      if (!teachers || !form) return unknown();
      if (!docTeacherForms(teachers).includes(form)) return fail('Το ' + quoted(teachers) + ' υπάρχει μόνο με «.Λίστα» (ένας σε κάθε γραμμή), γιατί η «.Γραμμή» χωρίζει ήδη τους εκπαιδευτικούς με «, ».');
      return ok(prefix + teachers + '.' + form, 'common', 'Text', {family: 'oloimero', day, slot, teachers: {...docTeacherKind(teachers), list: form === DOC_OLOIMERO_FORMS[0]}});
    }
    const scope = head === 'ΕΚΠ' ? 'staff' : head === 'ΤΜ' ? 'class' : '';
    if (!scope || !rest.length) return unknown();
    const prefix = DOC_SCOPE_PREFIX[scope] + '.';
    const statics = scope === 'staff' ? DOC_STAFF : DOC_CLASS;
    const field = statics.find(item => compareKey(item.name) === compareKey(rest.join('.')));
    if (field) return ok(prefix + field.name, scope, field.type, {family: 'static', field});
    const first = compareKey(rest[0]);
    if (rest.length === 1 && first === compareKey(DOC_ANCHOR_NAME)) return ok(prefix + DOC_ANCHOR_NAME, scope, 'Text', {family: 'anchor'});
    if (scope === 'class' && first === 'ΥΠΕΥΘΥΝΟΣ' && rest.length === 2) {
      const homeroom = DOC_HOMEROOM.find(item => compareKey(item.name) === compareKey(rest[1]));
      if (homeroom) return ok(prefix + 'Υπεύθυνος.' + homeroom.name, scope, homeroom.type, {family: 'homeroom', field: homeroom});
    }
    if (first === 'ΠΡ') {
      if (rest.length < 3 || rest.length > 4) return unknown();
      const day = DOC_DAYS.find(item => compareKey(item.key) === compareKey(rest[1]));
      if (!day) return fail('Η ημέρα ' + quoted(rest[1]) + ' δεν υπάρχει· οι ημέρες είναι Δε, Τρ, Τε, Πε, Πα.');
      const slot = docSlotKey(rest[2], info);
      if (!slot) return slotError(rest[2]);
      const variant = rest.length === 4 ? docOption(rest[3], scope === 'staff' ? DOC_STAFF_VARIANTS : DOC_CLASS_VARIANTS) : '';
      if (variant === undefined) return unknown();
      return ok(prefix + 'Πρ.' + day.key + '.' + slot + (variant ? '.' + variant : ''), scope, 'Text', {family: 'grid', day, slot, variant});
    }
    // An optional zone right after «Ώρες» (and «Εκπαιδευτικός»): only the hours of that zone count,
    // e.g. «Ώρες.Πρωινό.Μάθημα.ΓΛ.Δε.Ποιες», «Ώρες.Πρωινό.Δε», «Διδάσκοντες.Πρωινό.Μάθημα.ΓΛ».
    // One zone («Πρωινό») or several joined with «+» («ΠΖ+Γεύμα+Ολοήμερο»): the hours of any of them count.
    // → {zone} (null when the part is not a zone) or {error} for «+» with an unknown or repeated zone.
    const zoneSpec = value => {
      const parts = String(value ?? '').split('+').map(part => part.trim());
      const found = parts.map(part => DOC_ZONES.find(item => compareKey(item.key) === compareKey(part)) || null);
      if (parts.length === 1) return {zone: found[0] ? {key: found[0].key, keys: [found[0].key]} : null};
      if (found.some(item => !item)) return {error: 'Η ζώνη ' + quoted(parts[found.findIndex(item => !item)]) + ' δεν υπάρχει· οι ζώνες είναι ' + DOC_ZONES.map(item => item.key).join(', ') + ', ενωμένες με «+».'};
      const keys = found.map(item => item.key);
      if (new Set(keys).size !== keys.length) return {error: 'Μια ζώνη γράφεται μία φορά στο ' + quoted(value) + '.'};
      return {zone: {key: keys.join('+'), keys}};
    };
    const dayOf = value => DOC_DAYS.find(item => compareKey(item.key) === compareKey(value)) || null;
    const dayError = value => fail('Η ημέρα ' + quoted(value) + ' δεν υπάρχει· οι ημέρες είναι Δε, Τρ, Τε, Πε, Πα.');
    if (first === 'ΩΡΕΣ') {
      if (rest.length === 1) return ok(prefix + 'Ώρες', scope, 'Integer', {family: 'hours'});
      const spec1 = zoneSpec(rest[1]);
      if (spec1.error) return fail(spec1.error);
      const zone = spec1.zone, tail = rest.slice(zone ? 2 : 1), head = prefix + 'Ώρες.' + (zone ? zone.key + '.' : '');
      if (!tail.length) return ok(prefix + 'Ώρες.' + zone.key, scope, 'Integer', {family: 'hours', zone});
      if (compareKey(tail[0]) === 'ΜΑΘΗΜΑ') {
        if (tail.length < 2 || tail.length > 4) return unknown();
        const codes = docCodes(tail[1], info);
        if (codes.error) return fail(codes.error);
        if (!codes.code) return codeError(codes.missing);
        const code = codes.code;
        let name = head + 'Μάθημα.' + code, day = null, which = false;
        if (tail.length >= 3) {
          day = dayOf(tail[2]);
          if (!day) return dayError(tail[2]);
          name += '.' + day.key;
        }
        if (tail.length === 4) { if (compareKey(tail[3]) !== 'ΠΟΙΕΣ') return unknown(); which = true; name += '.Ποιες'; }
        return ok(name, scope, which ? 'Text' : 'Integer', {family: 'subjectHours', code, day, which, zone});
      }
      if (tail.length !== 1) return unknown();
      const day = dayOf(tail[0]);
      if (day) return ok(head + day.key, scope, 'Integer', {family: 'hours', day, zone});
      return unknown();
    }
    if (scope === 'class' && first === 'ΔΙΔΑΣΚΟΝΤΕΣ' && rest.length >= 3) {
      const spec1 = zoneSpec(rest[1]);
      if (spec1.error) return fail(spec1.error);
      const zone = spec1.zone, tail = rest.slice(zone ? 2 : 1);
      if (tail.length === 2 && compareKey(tail[0]) === 'ΜΑΘΗΜΑ') {
        const codes = docCodes(tail[1], info);
        if (codes.error) return fail(codes.error);
        if (!codes.code) return codeError(codes.missing);
        const code = codes.code;
        return ok(prefix + 'Διδάσκοντες.' + (zone ? zone.key + '.' : '') + 'Μάθημα.' + code, scope, 'Text', {family: 'subjectTeachers', code, zone});
      }
    }
    return unknown();
  }

  // Ένα πεδίο προτύπου (το κείμενο μέσα στα {{ }}, μαζί με το «:Τύπος» αν υπάρχει) →
  //   {data, name, canonical, known, scope, type, needsPeriod, anchor, message}
  //   data: έχει «@» (πεδίο από το κοινό αρχείο)· known: η γραφή είναι ακριβώς του καταλόγου (μόνο τότε
  //   συμπληρώνεται)· needsPeriod: η τιμή του χρειάζεται επιλεγμένη περίοδο (τα πεδία της περιόδου, του
  //   Ωρολογίου, των Τμημάτων Ολοημέρου και των μαθημάτων)· anchor: είναι ακριβώς {{@Εκπ.Άγκυρα}} ή {{@Τμ.Άγκυρα}}·
  //   message: προειδοποίηση ή υπόδειξη για τον χρήστη, ή κενό.
  // Χωρίς «@», ένα όνομα που μοιάζει με πεδίο του καταλόγου (Εκπ., Τμ., Ώρα., Μάθημα., Ολ.) δίνει υπόδειξη.
  // Οικογένειες πεδίων που παίρνουν την τιμή τους από το Ωρολόγιο της περιόδου. Ένα στατικό πεδίο τη χρειάζεται
  // μόνο όταν έχει «period» (Περίοδος, Περίοδος Από, Περίοδος Έως)· οι ώρες (Ώρα.…) έρχονται από τις Ώρες Διδασκαλίας.
  const DOC_PERIOD_FAMILIES = new Set(['grid', 'hours', 'subjectHours', 'subjectTeachers', 'subject', 'oloimero']);
  const docNeedsPeriod = spec => DOC_PERIOD_FAMILIES.has(spec?.family) || !!spec?.field?.period;
  function docRecognize(token, c) {
    const [rawName, ...typeParts] = String(token ?? '').split(':');
    const name = rawName.trim(), given = typeParts.join(':').trim(), info = c?.info || null;
    if (!name.startsWith(DOC_MARK)) {
      const parsed = /^(ΕΚΠ|ΤΜ|ΩΡΑ|ΜΑΘΗΜΑ|ΟΛ)\./.test(compareKey(name)) ? docParse(name, info) : null;
      return {data: false, name, canonical: '', known: false, scope: '', type: '', needsPeriod: false, anchor: false, message: parsed?.ok ? 'Μήπως εννοείς «{{' + DOC_MARK + parsed.name + '}}»; Χωρίς «' + DOC_MARK + '» το πεδίο συμπληρώνεται χειροκίνητα.' : ''};
    }
    const parsed = docParse(name.slice(DOC_MARK.length), info);
    if (!parsed.ok) return {data: true, name, canonical: '', known: false, scope: '', type: 'Text', needsPeriod: false, anchor: false, message: parsed.error};
    const canonical = DOC_MARK + parsed.name;
    const needsPeriod = docNeedsPeriod(parsed.spec);
    if (canonical !== name) return {data: true, name, canonical, known: false, scope: parsed.scope, type: parsed.type, needsPeriod, anchor: false, message: 'Μήπως εννοείς «{{' + canonical + '}}»;'};
    const message = given && compareKey(given) !== compareKey(parsed.type) ? 'Το πεδίο είναι ' + parsed.type + ' και δεν χρειάζεται «:' + given + '».' : '';
    return {data: true, name, canonical, known: true, scope: parsed.scope, type: parsed.type, needsPeriod, anchor: parsed.spec.family === 'anchor', message};
  }

  // Το είδος ενός προτύπου από τα πεδία του →
  //   {kind:'none'|'common'|'staff'|'class'|'mixed'|'anchored', staff:[ονόματα], class:[ονόματα], anchors:['staff'|'class']}.
  //   none: χωρίς πεδία «@»· common: μόνο κοινά (βγαίνει μία φορά)· mixed: και πεδία Εκπ. και πεδία Τμ.·
  //   anchored: έχει άγκυρες (ένα βιβλίο για όλους τους επιλεγμένους), και τότε Εκπ. και Τμ. μαζί επιτρέπονται.
  //   anchors: τα είδη των αγκυρών που βρέθηκαν (μόνο με ακριβή γραφή).
  function docTemplateKind(tokens, c) {
    const staff = [], classes = [], anchors = [];
    let data = false;
    for (const token of tokens || []) {
      const item = docRecognize(token, c);
      if (!item.data) continue;
      data = true;
      if (item.scope === 'staff') staff.push(item.name);
      if (item.scope === 'class') classes.push(item.name);
      if (item.anchor) anchors.push(item.scope);
    }
    const kind = !data ? 'none' : anchors.length ? 'anchored' : staff.length && classes.length ? 'mixed' : staff.length ? 'staff' : classes.length ? 'class' : 'common';
    return {kind, staff: unique(staff), class: unique(classes), anchors: ['staff', 'class'].filter(scope => anchors.includes(scope))};
  }

  // Το context για τις τιμές, από το school-documents:context του Κεντρικού Μενού:
  //   input: {school, year, staff, classes, teachingHours, periods, programs, studentCounts}
  //   options: {periodId, today}
  // → {schoolName, year, period, program, design, composition, slots, rows, slotError, subjects, info, …}. program:
  //   το Ωρολόγιο (school) της περιόδου, για τα μαθήματα με κωδικό και ως προϋπόθεση των πεδίων του προγράμματος·
  //   design: το σχέδιο Ολοημέρου (oloimero) της περιόδου, για τις θέσεις· composition: η σύνθεση της περιόδου, από
  //   την οποία παίρνονται οι δραστηριότητες (null χωρίς περίοδο ή με λάθος στις Ώρες Διδασκαλίας).
  function docContext(input = {}, options = {}) {
    const staff = (input.staff || []).filter(isObject), classes = (input.classes || []).filter(isObject);
    const year = String(input.year || input.school?.year || '');
    const period = (input.periods || []).find(item => item?.id === options.periodId) || null;
    const program = period ? (input.programs || []).find(item => item?.kind === 'school' && item.periodId === period.id) || null : null;
    const design = period ? (input.programs || []).find(item => item?.kind === 'oloimero' && item.periodId === period.id) || null : null;
    let slots = [], rows = [], slotError = '';
    try { ({slots, rows} = docSlots(input.teachingHours)); } catch (error) { slotError = error.message; }
    let composition = null;
    if (period && !slotError) try { composition = composePeriod({periodId: period.id, programs: input.programs, staff, classes, teachingHours: input.teachingHours}); } catch {}
    const subjects = (program?.source?.subjects || []).filter(item => String(item?.code ?? '').trim())
      .map(item => ({code: String(item.code).trim(), name: String(item.name ?? '').trim(), longName: String(item.longName ?? '').trim()}));
    const codes = program ? new Map(subjects.map(item => [compareKey(item.code), item.code])) : null;
    return {
      schoolName: docPlain(input.school?.name), year, staff, classes, sortedStaff: sortStaff(staff), staffById: new Map(staff.map(person => [person.id, person])),
      classesById: classesById(classes), studentCounts: isObject(input.studentCounts) ? input.studentCounts : {},
      period, program, design, composition, slots, rows, slotError, subjects, today: options.today || today(),
      info: {slotKeys: slots.length ? new Set(slots.map(slot => slot.key)) : null, codes}
    };
  }

  // ---- Τιμές ----
  const slotOverlaps = (time, slot) => time.start < slot.end && slot.start < time.end;
  // The activities of a teacher or a τμήμα. From the composition, each with only its times that count; a τμήμα
  // without the support activities (they are not lessons of the class).
  const docActivities = (c, test) => c.composition
    ? c.composition.entries.filter(entry => test(entry)).map(entry => entry.times === entry.activity.times ? entry.activity : {...entry.activity, times: entry.times})
    : (c.program?.activities || []).filter(activity => test({activity, support: false}));
  function docTargetData(c, target) {
    const test = target?.type === 'staff' ? entry => (entry.activity.staff || []).includes(target.id)
      : target?.type === 'class' ? entry => !entry.support && (entry.activity.classes || []).includes(target.id) : () => false;
    return {type: target?.type, list: docActivities(c, test)};
  }
  const docTimes = (data, activities = data.list) => {
    const items = activities.flatMap(activity => (activity.times || []).map(time => ({activity, time})));
    if (data.type !== 'class') return items;
    // Ένα τμήμα μετρά κάθε ώρα μία φορά (π.χ. Γαλλικά και Γερμανικά την ίδια ώρα).
    const seen = new Set();
    return items.filter(item => { const key = item.time.day + '|' + item.time.start + '|' + item.time.end; if (seen.has(key)) return false; seen.add(key); return true; });
  };
  // The lesson names of a code, or of codes joined with «+».
  const docSubjectKeys = (c, code) => { const codes = String(code).split('+').map(compareKey); return new Set(c.subjects.filter(item => codes.includes(compareKey(item.code))).map(item => compareKey(item.name))); };
  // In documents a whole grade is written without the apostrophe: «Ε'» → «Ε», «Α'-Στ'» → «Α-Στ» (the apps keep «Ε'»).
  const docGradePlain = text => String(text).replace(/(^|[\s,(-])(Α|Β|Γ|Δ|Ε|Στ)['΄’](?=$|[\s,)-])/g, '$1$2');
  // The subject of an activity, always through activitySubject, with the composition of the period.
  const docSubject = (c, activity) => activitySubject(activity, c.composition ? {composition: c.composition, classes: c.classes} : {programs: c.program ? [c.program] : [], classes: c.classes});
  const docTeachers = (c, activity, short) => [...(activity.staff || []).map(id => { const person = c.staffById.get(id); return person ? String((short ? person.shortName : person.name) || person.shortName || person.name || '') : ''; }), ...(activity.unmatched || [])];

  function docGridValue(c, data, spec) {
    const slot = c.slots.find(item => item.key === spec.slot);
    if (!slot) return '';
    const cell = data.list.filter(activity => (activity.times || []).some(time => time.day === spec.day.day && slotOverlaps(time, slot)));
    const students = activity => studentsText(activity, {classes: c.classes});
    const subject = activity => docSubject(c, activity);
    if (data.type === 'staff') {
      if (spec.variant === 'Μάθημα') return docJoin(cell.map(subject), ' / ');
      // The classes of the hour without subsets («Ε1-Γαλ, Ε2-Γαλ» → «Ε»), and a whole grade without apostrophe.
      if (spec.variant === 'Τμήμα') return docJoin(cell.map(activity => docGradePlain(studentsText({...activity, subsets: []}, {classes: c.classes}))), ' / ');
      // Only the grade (Α … Στ) of the classes of the hour, in grade order; other classes are left out for now.
      if (spec.variant === 'Τάξη') {
        const grades = new Set(cell.flatMap(activity => (activity.classes || []).map(id => c.classesById.get(id)).filter(isGeneralClass).map(record => gradeIndex(record.grade))));
        return [...grades].sort((a, b) => a - b).map(index => gradeName(GRADES[index])).join(', ');
      }
      if (spec.variant === 'Αίθουσα') return docJoin(cell.map(activity => activity.room), ' / ');
      return docJoin(cell.map(activity => { const who = students(activity); return subject(activity) + (who ? ' (' + who + ')' : ''); }), ' / ');
    }
    if (spec.variant === 'Μάθημα') return docJoin(cell.map(subject), ' / ');
    if (spec.variant === 'Εκπαιδευτικός' || spec.variant === 'Εκπαιδευτικός Σύντομο') return docJoin(cell.map(activity => docJoin(docTeachers(c, activity, spec.variant === 'Εκπαιδευτικός Σύντομο'), ', ')), ' / ');
    if (spec.variant === 'Αίθουσα') return docJoin(cell.map(activity => activity.room), ' / ');
    return docJoin(cell.map(activity => { const who = docJoin(docTeachers(c, activity, false), ', '); return subject(activity) + (who ? ' (' + who + ')' : ''); }), ' / ');
  }
  // The hours of the grid in a zone (all of them without a zone), and the times that fall in them.
  const docZoneSlots = (c, zone) => zone ? c.slots.filter(slot => zone.keys.includes(slot.zone)) : c.slots;
  const docInZone = (c, items, zone) => { if (!zone) return items; const slots = docZoneSlots(c, zone); return items.filter(item => slots.some(slot => slotOverlaps(item.time, slot))); };
  function docHoursValue(c, data, spec) {
    let items = docTimes(data);
    if (spec.day) items = items.filter(item => item.time.day === spec.day.day);
    return String(docInZone(c, items, spec.zone).length);
  }
  function docSubjectHoursValue(c, data, spec) {
    const keys = docSubjectKeys(c, spec.code);
    let items = docTimes(data, data.list.filter(activity => keys.has(compareKey(docSubject(c, activity)))));
    if (spec.day) items = items.filter(item => item.time.day === spec.day.day);
    items = docInZone(c, items, spec.zone);
    if (!spec.which) return String(items.length);
    return unique(docZoneSlots(c, spec.zone).filter(slot => items.some(item => slotOverlaps(item.time, slot))).map(slot => slot.key)).join('+');
  }

  // ---- Τμήματα Ολοημέρου ----
  // Οι θέσεις («Τμήμα 1, 2…» μιας ώρας) είναι οι θέσεις του σχεδίου Ολοημέρου της περιόδου (source.placements[id].slot)·
  // το περιεχόμενο είναι η σύνθεση της περιόδου, δηλαδή το σχέδιο Ολοημέρου, ή το Ωρολόγιο όταν η περίοδος δεν έχει
  // σχέδιο. Κάθε ώρα δραστηριότητας που είναι ολόκληρη σε ώρα Ολοημέρου παίρνει τη θέση της «ίδιας» ώρας του σχεδίου
  // (sameKey, ανά ώρα). Όσες δεν έχουν θέση (ή όλες, χωρίς σχέδιο) μπαίνουν στις πρώτες ελεύθερες θέσεις της ώρας, με τη σειρά των μαθητών τους
  // (SchoolClasses.sort του πρώτου τμήματος) και μετά του μαθήματος.
  // → {cells: Map('ημέρα|ώρα' → Map(αριθμός τμήματος → [δραστηριότητες])), moved:[{activity, day, slot, number}]}
  //   moved: όσες μπήκαν σε ελεύθερη θέση ενώ η περίοδος έχει σχέδιο. Υπολογίζεται μία φορά ανά context.
  const docOloimeroCache = new WeakMap();
  function docOloimeroLayout(c) {
    if (docOloimeroCache.has(c)) return docOloimeroCache.get(c);
    const layout = {cells: new Map(), moved: []};
    const slots = c.slots.filter(slot => OLOIMERO_CATEGORIES.includes(slot.category));
    const slotOf = time => slots.find(slot => slot.start <= time.start && time.end <= slot.end) || null;
    const keyOf = (activity, time) => sameKey({...activity, times: [time]}, c.classes);
    const waiting = new Map(), placements = isObject(c.design?.source?.placements) ? c.design.source.placements : {};
    for (const activity of c.design?.activities || []) {
      const place = placements[activity.id];
      if (!place || !Number.isInteger(place.slot) || place.slot < 0) continue;
      for (const time of activity.times || []) {
        const key = keyOf(activity, time);
        if (!waiting.has(key)) waiting.set(key, []);
        waiting.get(key).push(place.slot + 1);
      }
    }
    const put = (cellKey, number, activity) => {
      if (!layout.cells.has(cellKey)) layout.cells.set(cellKey, new Map());
      const cell = layout.cells.get(cellKey);
      if (!cell.has(number)) cell.set(number, []);
      if (!cell.get(number).includes(activity)) cell.get(number).push(activity);
    };
    const loose = new Map();
    for (const activity of docActivities(c, () => true)) {
      for (const time of activity.times || []) {
        if (!Number.isInteger(time?.day) || time.day < 1 || time.day > 5) continue;
        const slot = slotOf(time);
        if (!slot) continue;
        const cellKey = time.day + '|' + slot.key, queue = waiting.get(keyOf(activity, time));
        if (queue?.length) { put(cellKey, queue.shift(), activity); continue; }
        if (!loose.has(cellKey)) loose.set(cellKey, []);
        loose.get(cellKey).push({activity, day: time.day, slot});
      }
    }
    const order = new Map(sortClasses(c.classes).map((record, index) => [record.id, index]));
    const rank = activity => Math.min(1e9, ...(activity.classes || []).map(id => order.has(id) ? order.get(id) : 1e9));
    const text = activity => studentsText(activity, {classes: c.classes});
    for (const [cellKey, items] of loose) {
      items.sort((a, b) => rank(a.activity) - rank(b.activity) || text(a.activity).localeCompare(text(b.activity), 'el') || docSubject(c, a.activity).localeCompare(docSubject(c, b.activity), 'el'));
      let number = 1;
      for (const item of items) {
        while (layout.cells.get(cellKey)?.has(number)) number++;
        put(cellKey, number, item.activity);
        if (c.design) layout.moved.push({...item, number});
      }
    }
    docOloimeroCache.set(c, layout);
    return layout;
  }
  // The teachers of an activity, as names; with branch, «Όνομα (ΠΕ70)» (without brackets when Προσωπικό has no branch,
  // and for those not matched, who keep the name of the file).
  const docTeacherLabels = (c, activity, kind) => [
    ...(activity.staff || []).map(id => {
      const person = c.staffById.get(id);
      if (!person) return '';
      const name = String((kind.short ? person.shortName : person.name) || person.shortName || person.name || ''), branch = String(person.branch ?? '').trim();
      if (!branch || !kind.branch) return name;
      return kind.branch === 'comma' ? name + ', ' + branch : name + ' (' + branch + ')';
    }),
    ...(activity.unmatched || [])
  ];
  function docOloimeroValue(c, spec) {
    const cell = docOloimeroLayout(c).cells.get(spec.day.day + '|' + spec.slot) || new Map();
    if (spec.teachers) {
      const people = [...cell.keys()].sort((a, b) => a - b).flatMap(number => cell.get(number).flatMap(activity => docTeacherLabels(c, activity, spec.teachers)));
      return docJoin(people, spec.teachers.list ? '\n' : ', ');
    }
    const list = cell.get(spec.number) || [];
    // A detail of the teacher (Κλάδος, Κωδικός…): one value per teacher, «, » between teachers of one activity and
    // « / » between activities; those not matched have no details.
    if (spec.field) return list.map(activity => (activity.staff || []).map(id => c.staffById.get(id)).filter(Boolean).map(person => String(spec.field.get(c, person) ?? '').trim()).filter(Boolean).join(', ')).filter(Boolean).join(' / ');
    if (docTeacherKind(spec.variant || '').branch) return docJoin(list.map(activity => docJoin(docTeacherLabels(c, activity, docTeacherKind(spec.variant)), ', ')), ' / ');
    return docGridValue(c, {type: 'class', list}, {day: spec.day, slot: spec.slot, variant: spec.variant});
  }
  // Οι παρατηρήσεις των Τμημάτων Ολοημέρου ενός προτύπου, για τα «Πεδία που θέλουν έλεγχο» και τη σύνοψη.
  //   names: τα πεδία του προτύπου (με ή χωρίς «:Τύπος»). Μετρούν μόνο τα πεδία Ολ.Πρ.<ημέρα>.<ώρα>.Τμ… με ακριβή
  //   γραφή, και μόνο με Ωρολόγιο στην περίοδο.
  // → {warnings:[κείμενο…], infos:[κείμενο…]}. warnings: δραστηριότητες χωρίς θέση στο σχέδιο, που μπήκαν σε
  //   ελεύθερη θέση, και τμήματα του προγράμματος πέρα από το μεγαλύτερο Τμ του προτύπου για την ίδια ημέρα και ώρα·
  //   infos: η περίοδος δεν έχει σχέδιο Ολοημέρου.
  function docOloimeroNotes(names, c) {
    const out = {warnings: [], infos: []};
    if (!c?.program) return out;
    const limits = new Map();
    for (const raw of names || []) {
      const name = String(raw ?? '').split(':')[0].trim();
      if (!name.startsWith(DOC_MARK)) continue;
      const parsed = docParse(name.slice(DOC_MARK.length), c.info);
      if (!parsed.ok || parsed.spec.family !== 'oloimero' || !parsed.spec.number || DOC_MARK + parsed.name !== name) continue;
      const key = parsed.spec.day.day + '|' + parsed.spec.slot;
      limits.set(key, Math.max(limits.get(key) || 0, parsed.spec.number));
    }
    if (!limits.size) return out;
    if (!c.design) out.infos.push('Η περίοδος ' + quoted(c.period?.name || '') + ' δεν έχει σχέδιο Ολοημέρου: τα τμήματα του Ολοημέρου αριθμούνται με τη σειρά των μαθητών τους.');
    const layout = docOloimeroLayout(c), slotIndex = new Map(c.slots.map((slot, index) => [slot.key, index]));
    const where = (day, key) => { const slot = c.slots.find(item => item.key === key); return DOC_DAYS.find(item => item.day === day).label + ', ' + key + (slot ? ' (' + slot.time + ')' : ''); };
    const describe = activity => {
      const parts = [studentsText(activity, {classes: c.classes}), docJoin(docTeachers(c, activity, false), ', ')].filter(Boolean);
      return quoted(docSubject(c, activity) || '—') + (parts.length ? ' (' + parts.join(' · ') + ')' : '');
    };
    const byPlace = (a, b) => a.day - b.day || (slotIndex.get(a.key) ?? 0) - (slotIndex.get(b.key) ?? 0);
    const moved = layout.moved.map(item => ({...item, key: item.slot.key})).filter(item => limits.has(item.day + '|' + item.key)).sort((a, b) => byPlace(a, b) || a.number - b.number);
    for (const item of moved) out.warnings.push('Ολοήμερο, ' + where(item.day, item.key) + ': η δραστηριότητα ' + describe(item.activity) + ' δεν έχει θέση στο σχέδιο Ολοημέρου ' + quoted(c.design.name || '') + ' και μπήκε στο Τμήμα ' + item.number + '.');
    const places = [...limits.keys()].map(key => { const [day, slot] = key.split('|'); return {day: Number(day), key: slot}; }).sort(byPlace);
    for (const place of places) {
      const limit = limits.get(place.day + '|' + place.key), cell = layout.cells.get(place.day + '|' + place.key);
      const over = cell ? [...cell.keys()].filter(number => number > limit).sort((a, b) => a - b) : [];
      if (over.length) out.warnings.push('Ολοήμερο, ' + where(place.day, place.key) + ': το πρόγραμμα της περιόδου έχει ' + (over.length === 1 ? 'και το Τμήμα ' + over[0] : 'και τα Τμήματα ' + over.join(', ')) + ', αλλά το πρότυπο έχει πεδία έως το Τμ' + limit + '· ' + (over.length === 1 ? 'δεν γράφεται' : 'δεν γράφονται') + ' στο έγγραφο.');
    }
    return out;
  }

  // Οι τιμές των πεδίων «@» για έναν εκπαιδευτικό ({type:'staff', id}), ένα τμήμα ({type:'class', id}) ή μόνο
  // τα κοινά (null), στο context του docContext. names: τα ονόματα των πεδίων (χωρίς το «:Τύπος»).
  // → Map(όνομα → κείμενο). Ημερομηνίες dd/mm/yyyy, ακέραιοι ως αριθμοί. Ένα πεδίο «@» που δεν είναι
  // ακριβώς του καταλόγου, ή άλλου είδους από τον στόχο, παίρνει κενή τιμή. Χωρίς Ωρολόγιο στην περίοδο, τα
  // πεδία του προγράμματος μένουν κενά.
  function docValues(names, target, c) {
    const out = new Map();
    const person = target?.type === 'staff' ? c.staffById.get(target.id) : null;
    const record = target?.type === 'class' ? c.classesById.get(target.id) : null;
    let data = null;
    for (const raw of names || []) {
      const name = String(raw ?? '').split(':')[0].trim();
      if (!name.startsWith(DOC_MARK) || out.has(name)) continue;
      const item = docRecognize(name, c);
      out.set(name, '');
      if (!item.known) continue;
      const {spec, scope} = docParse(name.slice(DOC_MARK.length), c.info);
      if (scope === 'common') {
        if (spec.family === 'static') out.set(name, spec.field.get(c));
        else if (spec.family === 'time') out.set(name, c.slots.find(slot => slot.key === spec.slot)?.time || '');
        else if (spec.family === 'subject') { const subject = c.subjects.find(entry => compareKey(entry.code) === compareKey(spec.code)); out.set(name, subject ? (spec.full ? subject.longName || subject.name : subject.name) : ''); }
        else if (spec.family === 'oloimero') out.set(name, c.program ? docOloimeroValue(c, spec) : '');
        continue;
      }
      const owner = scope === 'staff' ? person : record;
      if (!owner || spec.family === 'anchor') continue;
      if (spec.family === 'static') { out.set(name, spec.field.get(c, owner)); continue; }
      if (spec.family === 'homeroom') { const homeroom = owner.homeroomStaffId ? c.staffById.get(owner.homeroomStaffId) : null; out.set(name, homeroom ? spec.field.get(c, homeroom) : ''); continue; }
      if (!c.program) continue;
      data ||= docTargetData(c, target);
      if (spec.family === 'grid') out.set(name, docGridValue(c, data, spec));
      else if (spec.family === 'hours') out.set(name, docHoursValue(c, data, spec));
      else if (spec.family === 'subjectHours') out.set(name, docSubjectHoursValue(c, data, spec));
      else if (spec.family === 'subjectTeachers') {
        // With a zone: only those who teach the lesson at an hour of that zone.
        const keys = docSubjectKeys(c, spec.code), slots = docZoneSlots(c, spec.zone);
        const inZone = activity => !spec.zone || (activity.times || []).some(time => slots.some(slot => slotOverlaps(time, slot)));
        out.set(name, docJoin(data.list.filter(activity => keys.has(compareKey(docSubject(c, activity))) && inZone(activity)).flatMap(activity => docTeachers(c, activity, false)), ', '));
      }
    }
    return out;
  }

  // ---- Κατάλογος για το παράθυρο «Πεδία» ----
  // → {groups:[{key, label, fields:[{name, type, help, example, pattern, first, last, names}]}], subjects}
  //   Τα πεδία έχουν το «@» και χωρίς άγκιστρα. pattern: γραμμή-μοτίβο (πλέγμα, ώρες, μαθήματα)· names: όλα
  //   τα πεδία της γραμμής, για την αναζήτηση· first / last: το πρώτο και το τελευταίο. Με το context ενός
  //   έτους οι ώρες και οι κωδικοί είναι οι πραγματικοί· χωρίς αυτό, «<ώρα>» και «<κωδικός>».
  function docSlotsText(c) {
    if (!c?.slots?.length) return 'Οι ώρες ανά ζώνη: ΠΖ1… (Πρωινή Ζώνη), 1…6 (Πρωινό), ΓΕΥΜΑ1… (Γεύμα), ΟΛΟ1… (Ολοήμερο και Διευρυμένο).';
    const parts = [];
    for (const zone of DOC_ZONES) {
      const list = c.slots.filter(slot => slot.zone === zone.key);
      if (!list.length) continue;
      const keys = list.length === 1 ? list[0].key : list[0].key + '–' + list[list.length - 1].key;
      parts.push(zone.label + ' ' + keys + ' (' + docTime(list[0].start, list[list.length - 1].end) + ')');
    }
    return 'Ημέρες Δε, Τρ, Τε, Πε, Πα. Ώρες: ' + parts.join(' · ') + '.';
  }
  function docCatalog(c) {
    const M = DOC_MARK, slots = c?.slots?.length ? c.slots.map(slot => slot.key) : null, codes = c?.subjects?.length ? c.subjects.map(item => item.code) : null;
    const plain = (field, prefix = '') => ({name: M + prefix + field.name, type: field.type, help: field.help, example: field.example, pattern: false});
    const pattern = (names, fallback, type, help, example) => names
      ? {name: names[0] + (names.length > 1 ? ' … ' + names[names.length - 1] : ''), first: names[0], last: names[names.length - 1], names, type, help, example, pattern: true}
      : {name: fallback, first: '', last: '', names: [], type, help, example, pattern: true};
    const grid = (scope, variant) => {
      const prefix = M + DOC_SCOPE_PREFIX[scope] + '.Πρ.', tail = variant ? '.' + variant : '';
      return slots ? DOC_DAYS.flatMap(day => slots.map(slot => prefix + day.key + '.' + slot + tail)) : null;
    };
    const slotsHelp = docSlotsText(c);
    // Τμήματα Ολοημέρου: ημέρες × ώρες Ολοημέρου × Τμ1…Τμ20, και οι εκπαιδευτικοί της ώρας.
    const oloimeroSlots = slots ? slots.filter(slot => DOC_OLOIMERO_SLOT.test(slot)) : null, O = M + DOC_OLOIMERO_PREFIX + '.Πρ.';
    const numbered = (day, slot, tail) => Array.from({length: OLOIMERO_MAX_SLOTS}, (_, index) => O + day.key + '.' + slot + '.Τμ' + (index + 1) + tail);
    const oloimeroNames = (tail, single = false) => oloimeroSlots ? DOC_DAYS.flatMap(day => oloimeroSlots.flatMap(slot => single ? [O + day.key + '.' + slot + '.' + tail] : numbered(day, slot, tail))) : null;
    const oloimeroNote = ' Τα «Τμήμα 1, 2…» μιας ώρας είναι οι θέσεις της ώρας στον Ολοήμερο Designer («Σχεδιασμός»), από το σχέδιο Ολοημέρου της περιόδου· το περιεχόμενο έρχεται από το Ωρολόγιο. Μόνο ώρες Ολοημέρου (ΠΖ…, ΓΕΥΜΑ…, ΟΛΟ…), τμήματα Τμ1 έως Τμ' + OLOIMERO_MAX_SLOTS + '.';
    const oloimeroVariant = {Μάθημα: ['το μάθημα', 'Αγγλικά'], Εκπαιδευτικός: ['ο εκπαιδευτικός, με το πλήρες όνομα', 'Παπαδόπουλος Γιώργος'], 'Εκπαιδευτικός Σύντομο': ['ο εκπαιδευτικός, με το σύντομο όνομα', '[ΠΕ06] - Αγγλικά'], Αίθουσα: ['η αίθουσα', 'Αίθουσα 3'],
      'Εκπαιδευτικός (Κλάδος)': ['ο εκπαιδευτικός, με το πλήρες όνομα και τον κλάδο σε παρένθεση (χωρίς παρένθεση όταν δεν υπάρχει κλάδος)', 'Παπαδόπουλος Γιώργος (ΠΕ06)'], 'Εκπαιδευτικός Σύντομο (Κλάδος)': ['ο εκπαιδευτικός, με το σύντομο όνομα και τον κλάδο σε παρένθεση (χωρίς παρένθεση όταν δεν υπάρχει κλάδος)', '[ΠΕ06] - Αγγλικά (ΠΕ06)']};
    const teachersLabel = teachers => { const kind = docTeacherKind(teachers); return (kind.short ? 'το σύντομο όνομα' : 'το πλήρες όνομα') + (kind.branch === 'paren' ? ' και τον κλάδο σε παρένθεση, π.χ. «Μάρκου Παρασκευή (ΠΕ70)» (χωρίς παρένθεση όταν δεν υπάρχει κλάδος)' : kind.branch === 'comma' ? ' και τον κλάδο μετά από κόμμα, π.χ. «Μάρκου Παρασκευή, ΠΕ70» (χωρίς κόμμα όταν δεν υπάρχει κλάδος)' : ''); };
    const teachersExample = (teachers, form) => { const kind = docTeacherKind(teachers); return (kind.short ? [['[ΠΕ06] - Αγγλικά', 'ΠΕ06'], ['[Α1] - Δασκάλα', 'ΠΕ70']] : [['Παπαδόπουλος Γιώργος', 'ΠΕ06'], ['Μάρκου Παρασκευή', 'ΠΕ70']]).map(([name, branch]) => kind.branch === 'paren' ? name + ' (' + branch + ')' : kind.branch === 'comma' ? name + ', ' + branch : name).join(form === DOC_OLOIMERO_FORMS[0] ? '\n' : ', '); };
    const oloimeroFields = [
      pattern(oloimeroNames(''), O + '<ημέρα>.<ώρα>.Τμ<αριθμός>', 'Text', 'Ένα τμήμα του Ολοημέρου μία ώρα: μάθημα και εκπαιδευτικός, π.χ. «Αγγλικά (Παπαδόπουλος Γιώργος)». Δύο δραστηριότητες στην ίδια θέση χωρίζονται με « / ».' + oloimeroNote, 'Αγγλικά (Παπαδόπουλος Γιώργος)'),
      ...DOC_OLOIMERO_VARIANTS.map(variant => pattern(oloimeroNames('.' + variant), O + '<ημέρα>.<ώρα>.Τμ<αριθμός>.' + variant, 'Text', 'Μόνο ' + oloimeroVariant[variant][0] + ' του τμήματος του Ολοημέρου, π.χ. για ένα κελί με το μάθημα και από κάτω τον εκπαιδευτικό.' + oloimeroNote, oloimeroVariant[variant][1])),
      ...DOC_OLOIMERO_TEACHERS.flatMap(teachers => docTeacherForms(teachers).map(form => pattern(oloimeroNames(teachers + '.' + form, true), O + '<ημέρα>.<ώρα>.' + teachers + '.' + form, 'Text',
        'Όλοι οι εκπαιδευτικοί της ώρας εκείνη την ημέρα, από όλα τα τμήματα (π.χ. για ένα κελί «Όλα τα τμήματα» της Πρωινής Ζώνης ή του Γεύματος), με ' + teachersLabel(teachers) + ', με τη σειρά Τμήμα 1, 2, … και ο καθένας μία φορά· ' + (form === DOC_OLOIMERO_FORMS[0] ? 'ένας σε κάθε γραμμή (σε XLSX το κελί χρειάζεται αναδίπλωση κειμένου).' : 'σε μία γραμμή, με «, ».') + ' Μόνο ώρες Ολοημέρου (ΠΖ…, ΓΕΥΜΑ…, ΟΛΟ…).',
        teachersExample(teachers, form)))),
      // The details of the teacher of a τμήμα, as the fields {{@Εκπ.…}}.
      ...DOC_STAFF.map(field => pattern(oloimeroNames('.Εκπαιδευτικός.' + field.name), O + '<ημέρα>.<ώρα>.Τμ<αριθμός>.Εκπαιδευτικός.' + field.name, field.type,
        'Του εκπαιδευτικού του τμήματος του Ολοημέρου, όπως το {{@Εκπ.' + field.name + '}}: ' + field.help.charAt(0).toLocaleLowerCase('el') + field.help.slice(1) + ' Δύο εκπαιδευτικοί με «, », δύο δραστηριότητες στην ίδια θέση με « / »· όσοι δεν αντιστοιχίστηκαν στο Προσωπικό δεν έχουν στοιχεία.' + oloimeroNote, field.example))
    ];
    const byCode = (make) => codes ? codes.map(make) : null;
    const scopeGroups = scope => {
      const P = DOC_SCOPE_PREFIX[scope], label = scope === 'staff' ? 'εκπαιδευτικού' : 'τμήματος';
      const variants = scope === 'staff' ? DOC_STAFF_VARIANTS : DOC_CLASS_VARIANTS;
      const cellHelp = scope === 'staff' ? 'μάθημα και τμήμα, π.χ. «Γλώσσα (Α1)»' : 'μάθημα και εκπαιδευτικός, π.χ. «Γλώσσα (Μάρκου Παρασκευή)»';
      const program = [pattern(grid(scope, ''), M + P + '.Πρ.<ημέρα>.<ώρα>', 'Text', 'Μία ώρα του προγράμματος του ' + label + ': ' + cellHelp + '. Δύο δραστηριότητες στην ίδια ώρα χωρίζονται με « / ». ' + slotsHelp, scope === 'staff' ? 'Γλώσσα (Α1)' : 'Γλώσσα (Μάρκου Παρασκευή)'),
        ...variants.map(variant => pattern(grid(scope, variant), M + P + '.Πρ.<ημέρα>.<ώρα>.' + variant, 'Text', 'Μόνο ' + ({Μάθημα: 'το μάθημα', Τμήμα: 'το τμήμα (χωρίς υποσύνολα, π.χ. «Ε» για τα Γαλλικά του Ε1 και του Ε2· ολόκληρη τάξη χωρίς απόστροφο)', Τάξη: 'η τάξη (Α, Β, Γ, Δ, Ε ή Στ, χωρίς τμήμα και υποσύνολα· δύο τάξεις με «, »)', Αίθουσα: 'η αίθουσα', Εκπαιδευτικός: 'ο εκπαιδευτικός, με το πλήρες όνομα', 'Εκπαιδευτικός Σύντομο': 'ο εκπαιδευτικός, με το σύντομο όνομα'})[variant] + ' της ώρας. ' + slotsHelp, ({Μάθημα: 'Γλώσσα', Τμήμα: 'Α1', Τάξη: 'Α', Αίθουσα: 'Αίθουσα 3', Εκπαιδευτικός: 'Μάρκου Παρασκευή', 'Εκπαιδευτικός Σύντομο': '[Α1] - Δασκάλα'})[variant]))];
      const hours = [
        {name: M + P + '.Ώρες', type: 'Integer', help: 'Όλες οι ώρες του ' + label + ' στο Ωρολόγιο της περιόδου.' + (scope === 'class' ? ' Κάθε ώρα μετρά μία φορά, και όταν έχει δύο μαθήματα (π.χ. Γαλλικά και Γερμανικά).' : ''), example: scope === 'staff' ? '22' : '30', pattern: false},
        ...DOC_ZONES.map(zone => ({name: M + P + '.Ώρες.' + zone.key, type: 'Integer', help: 'Οι ώρες στη ζώνη «' + zone.label + '».', example: zone.key === 'Πρωινό' ? '18' : '1', pattern: false})),
        pattern(DOC_DAYS.map(day => M + P + '.Ώρες.' + day.key), '', 'Integer', 'Οι ώρες σε κάθε ημέρα (Δε, Τρ, Τε, Πε, Πα).', '5'),
        pattern(byCode(code => M + P + '.Ώρες.Μάθημα.' + code), M + P + '.Ώρες.Μάθημα.<κωδικός>', 'Integer', 'Οι ώρες σε ένα μάθημα, με τον κωδικό του μαθήματος στο FET. Και περισσότερα μαθήματα ενωμένα με «+» (π.χ. «ΓΑΛ+ΓΕΡ»), εδώ και στα πεδία ωρών και διδασκόντων παρακάτω: μετρούν οι ώρες οποιουδήποτε από αυτά.', '6'),
        pattern(codes ? codes.flatMap(code => DOC_DAYS.map(day => M + P + '.Ώρες.Μάθημα.' + code + '.' + day.key)) : null, M + P + '.Ώρες.Μάθημα.<κωδικός>.<ημέρα>', 'Integer', 'Οι ώρες σε ένα μάθημα μία ημέρα.', '2'),
        pattern(codes ? codes.flatMap(code => DOC_DAYS.map(day => M + P + '.Ώρες.Μάθημα.' + code + '.' + day.key + '.Ποιες')) : null, M + P + '.Ώρες.Μάθημα.<κωδικός>.<ημέρα>.Ποιες', 'Text', 'Ποιες ώρες έχει ένα μάθημα μία ημέρα, ενωμένες με «+», π.χ. «2» ή «3+4».', '3+4')
      ];
      if (scope === 'class') hours.push(pattern(byCode(code => M + 'Τμ.Διδάσκοντες.Μάθημα.' + code), M + 'Τμ.Διδάσκοντες.Μάθημα.<κωδικός>', 'Text', 'Ποιος διδάσκει ένα μάθημα στο τμήμα (πολλοί με «, »).', 'Μάρκου Παρασκευή'));
      // The same fields for one zone (the zone right after «Ώρες»): e.g. only the Πρωινό, without the Ολοήμερο.
      const zoneNote = ' Μόνο οι ώρες μιας ζώνης (' + DOC_ZONES.map(zone => zone.key).join(', ') + '), ή περισσότερων ενωμένων με «+», π.χ. «ΠΖ+Γεύμα+Ολοήμερο+Διευρυμένο».';
      const byZone = make => DOC_ZONES.flatMap(make);
      hours.push(
        pattern(byZone(zone => DOC_DAYS.map(day => M + P + '.Ώρες.' + zone.key + '.' + day.key)), '', 'Integer', 'Οι ώρες μιας ζώνης σε κάθε ημέρα, π.χ. οι ώρες του Πρωινού τη Δευτέρα. Και περισσότερες ζώνες ενωμένες με «+», π.χ. «' + M + P + '.Ώρες.ΠΖ+Ολοήμερο.Δε».', '5'),
        pattern(codes ? byZone(zone => codes.map(code => M + P + '.Ώρες.' + zone.key + '.Μάθημα.' + code)) : null, M + P + '.Ώρες.<ζώνη>.Μάθημα.<κωδικός>', 'Integer', 'Οι ώρες σε ένα μάθημα.' + zoneNote, '6'),
        pattern(codes ? byZone(zone => codes.flatMap(code => DOC_DAYS.map(day => M + P + '.Ώρες.' + zone.key + '.Μάθημα.' + code + '.' + day.key))) : null, M + P + '.Ώρες.<ζώνη>.Μάθημα.<κωδικός>.<ημέρα>', 'Integer', 'Οι ώρες σε ένα μάθημα μία ημέρα.' + zoneNote, '2'),
        pattern(codes ? byZone(zone => codes.flatMap(code => DOC_DAYS.map(day => M + P + '.Ώρες.' + zone.key + '.Μάθημα.' + code + '.' + day.key + '.Ποιες'))) : null, M + P + '.Ώρες.<ζώνη>.Μάθημα.<κωδικός>.<ημέρα>.Ποιες', 'Text', 'Ποιες ώρες έχει ένα μάθημα μία ημέρα, ενωμένες με «+».' + zoneNote, '3+4'));
      if (scope === 'class') hours.push(pattern(codes ? byZone(zone => codes.map(code => M + 'Τμ.Διδάσκοντες.' + zone.key + '.Μάθημα.' + code)) : null, M + 'Τμ.Διδάσκοντες.<ζώνη>.Μάθημα.<κωδικός>', 'Text', 'Ποιος διδάσκει ένα μάθημα στο τμήμα, σε ώρες μιας ζώνης (πολλοί με «, »).', 'Μάρκου Παρασκευή'));
      const title = scope === 'staff' ? 'Εκπαιδευτικός' : 'Τμήμα';
      const details = (scope === 'staff' ? DOC_STAFF : DOC_CLASS).map(field => plain(field, P + '.'));
      if (scope === 'class') details.push(...DOC_HOMEROOM.map(field => ({...plain(field, P + '.Υπεύθυνος.'), help: 'Του υπευθύνου του τμήματος (κενό χωρίς υπεύθυνο): ' + field.help.charAt(0).toLocaleLowerCase('el') + field.help.slice(1)})));
      details.push({name: M + P + '.' + DOC_ANCHOR_NAME, type: 'Text', pattern: false, example: '',
        help: 'Γράφει πάντα κενό. Σε πρότυπο XLSX σημειώνει μια θέση (π.χ. ένα μπλοκ του εντύπου): όλ' + (scope === 'staff' ? 'οι οι επιλεγμένοι εκπαιδευτικοί' : 'α τα επιλεγμένα τμήματα') + ' βγαίνουν σε ένα βιβλίο, ένας σε κάθε θέση, με τα πεδία του πρώτου μπλοκ της καρτέλας. Μπαίνει και μέσα σε κελί με κείμενο.'});
      return [
        {key: scope, label: title, fields: details},
        {key: scope + 'Program', label: 'Πρόγραμμα ' + label, fields: program},
        {key: scope + 'Hours', label: 'Ώρες ' + label, fields: hours}
      ];
    };
    return {
      groups: [
        {key: 'common', label: 'Κοινά', fields: [...DOC_COMMON.map(field => plain(field)), pattern(slots ? slots.map(slot => M + 'Ώρα.' + slot) : null, M + 'Ώρα.<ώρα>', 'Text', 'Το διάστημα μιας ώρας, π.χ. «07:15–08:00». ' + slotsHelp, '07:15–08:00')]},
        {key: 'oloimero', label: 'Ολοήμερο', fields: oloimeroFields},
        ...scopeGroups('staff'), ...scopeGroups('class'),
        {key: 'subjects', label: 'Μαθήματα', fields: [
          pattern(byCode(code => M + 'Μάθημα.' + code), M + 'Μάθημα.<κωδικός>', 'Text', 'Το όνομα ενός μαθήματος, όπως στο Ωρολόγιο, με τον κωδικό του στο FET. Μάθημα χωρίς κωδικό στο FET δεν έχει τέτοια πεδία.', 'Γλώσσα'),
          pattern(byCode(code => M + 'Μάθημα.' + code + '.Πλήρες'), M + 'Μάθημα.<κωδικός>.Πλήρες', 'Text', 'Το πλήρες όνομα του μαθήματος στο FET.', 'Νεοελληνική Γλώσσα')
        ]}
      ],
      subjects: (c?.subjects || []).map(item => ({...item}))
    };
  }

  // Ο έτοιμος πίνακας του πλέγματος (scope 'staff' ή 'class'): γραμμές οι ώρες, στήλες οι ημέρες, πρώτη στήλη το
  // {{@Ώρα.…}}. Τα διαλείμματα είναι γραμμές με την ώρα ως σταθερό κείμενο και «Διάλειμμα».
  // → {days:['Δευτέρα'…], rows:[{type:'slot', time:'{{@Ώρα.ΠΖ1}}', label, cells:['{{@Εκπ.Πρ.Δε.ΠΖ1}}'…]} | {type:'break', time, text:'Διάλειμμα'}]}
  function docReadyTable(scope, c) {
    const prefix = DOC_MARK + DOC_SCOPE_PREFIX[scope] + '.Πρ.';
    return {
      days: DOC_DAYS.map(day => day.label),
      rows: (c?.rows || []).map(row => row.type === 'break'
        ? {type: 'break', time: row.time, text: 'Διάλειμμα'}
        : {type: 'slot', time: '{{' + DOC_MARK + 'Ώρα.' + row.slot.key + '}}', label: row.slot.time, cells: DOC_DAYS.map(day => '{{' + prefix + day.key + '.' + row.slot.key + '}}')})
    };
  }

  // Ο έτοιμος πίνακας μαθημάτων (scope 'staff' ή 'class'), για έντυπα με μία γραμμή ανά μάθημα, χωρίς επικεφαλίδες.
  //   rows: οι κωδικοί των μαθημάτων με τη σειρά του εντύπου, null για κενή γραμμή.
  //   options.zone: μια ζώνη του ZONES (π.χ. 'Πρωινό'), για τα πεδία μόνο αυτής της ζώνης· χωρίς αυτή, όλες οι ζώνες.
  // → {days:[['{{@Τμ.Ώρες.Μάθημα.ΓΛ.Δε.Ποιες}}'…5] | ['','','','',''] …], teachers:['{{@Τμ.Διδάσκοντες.Μάθημα.ΓΛ}}' | ''…] | null}
  //   (teachers μόνο για τμήμα). Ένας κωδικός γράφεται όπως στο Ωρολόγιο της περιόδου, όταν υπάρχει.
  function docSubjectTable(scope, rows, c, options = {}) {
    const zone = DOC_ZONES.find(item => compareKey(item.key) === compareKey(options.zone)), Z = zone ? zone.key + '.' : '';
    const P = DOC_MARK + DOC_SCOPE_PREFIX[scope];
    const codeOf = code => code == null || String(code).trim() === '' ? null : c?.info?.codes?.get(compareKey(code)) || String(code).trim();
    const codes = (rows || []).map(codeOf);
    return {
      days: codes.map(code => code ? DOC_DAYS.map(day => '{{' + P + '.Ώρες.' + Z + 'Μάθημα.' + code + '.' + day.key + '.Ποιες}}') : DOC_DAYS.map(() => '')),
      teachers: scope === 'class' ? codes.map(code => code ? '{{' + P + '.Διδάσκοντες.' + Z + 'Μάθημα.' + code + '}}' : '') : null
    };
  }

  // Όνομα εγγράφου: «Πρότυπο - Επώνυμο Όνομα.docx» (εκπαιδευτικός, με το όνομα του Προσωπικού),
  // «Πρότυπο - Α1.docx» (τμήμα), ή το όνομα του προτύπου (χωρίς στόχο).
  function docFileName(template, target, c) {
    const text = String(template ?? ''), match = /^(.*?)(\.[^.]+)?$/.exec(text), base = match[1], ext = match[2] || '';
    const label = target?.type === 'staff' ? staffName(c, target.id) : target?.type === 'class' ? String(c.classesById.get(target.id)?.name ?? '') : '';
    const clean = label.replace(/[\\/:*?"<>|]+/g, '-').trim();
    return clean ? base + ' - ' + clean + ext : text;
  }
  // Ίδια ονόματα (χωρίς διάκριση πεζών–κεφαλαίων) παίρνουν « (2)», « (3)»… πριν από την επέκταση.
  function docUniqueNames(names) {
    const used = new Set();
    return (names || []).map(name => {
      const match = /^(.*?)(\.[^.]+)?$/.exec(String(name ?? '')), base = match[1], ext = match[2] || '';
      let candidate = base + ext, n = 1;
      while (used.has(candidate.toLocaleLowerCase('el'))) candidate = base + ' (' + (++n) + ')' + ext;
      used.add(candidate.toLocaleLowerCase('el'));
      return candidate;
    });
  }

  window.SchoolDocumentFields = Object.freeze({
    MARK: DOC_MARK, DAYS: DOC_DAYS, ZONES: DOC_ZONES, ROLE_LABELS: DOC_ROLE_LABELS, SERVICE_LABELS: DOC_SERVICE_LABELS,
    slots: docSlots, context: docContext, recognize: docRecognize, templateKind: docTemplateKind, values: docValues, oloimeroNotes: docOloimeroNotes,
    catalog: docCatalog, readyTable: docReadyTable, subjectTable: docSubjectTable, fileName: docFileName, uniqueNames: docUniqueNames
  });
  parts.loaded('_data_documents.js');
})();
