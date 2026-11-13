/*
 * Εφαρμογές σχολείου — Τμήματα στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.07
 * Όνομα κατά την εγκατάσταση: _host_classes.js
 *
 * Κώδικας μόνο του host για τα Τμήματα (classesByYear). Το φορτώνει το index.html μετά το _data.js και πριν
 * από το δικό του script: <script src="_host_classes.js"></script>. Δεν το φορτώνουν οι υποεφαρμογές· μόνο το
 * data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostClasses:
 *   APP                                     το αρχείο της εφαρμογής (school_classes.html)
 *   LIMITS                                  όρια πλήθους ({classes, warnRatio})
 *   yearClasses(data, year)                 τα τμήματα ενός έτους ([{id, name, …}])
 *   previousYears(data, year)               τα παλαιότερα έτη με τμήματα: [{year, classes:[τμήμα…]}], νεότερο πρώτο
 *   classUsage(data, year)                  σε ποια προγράμματα του έτους εμφανίζεται κάθε τμήμα (με το id)
 *   studentCounts(data, year)               πόσοι μαθητές του έτους (studentsByYear) είναι σε κάθε τμήμα (με το id)
 *   tagUsage(data, year)                    σε ποια στοιχεία ποιας εφαρμογής χρησιμοποιείται κάθε τμήμα ως ετικέτα
 *                                           (με το id· από το _host_tags.js)
 *   scoreUsage(data, year)                  σε πόσα Συμβάντα Ποινών / Επιβραβεύσεων του Ημερολογίου βαθμολογείται κάθε
 *                                           τμήμα (η μορφή του tagUsage· από το _host_calendar.js)
 *   context(data, revision)                 το school-classes:context
 *   validateClasses(classes, staff, options)  έλεγχος της λίστας ενός έτους· επιστρέφει καθαρό αντίγραφο (πετά λάθος)
 *   applySave(data, message)                εφαρμογή ενός school-classes:save σε αντίγραφο του data
 *   addClasses(candidate, year, added, app) νέα τμήματα των εισαγωγών (newClasses) στο classesByYear[year] του
 *                                           candidate, για το school-timetables:save και το school-students:save
 *   removeStaff(data, year, removedIds)     στην αποθήκευση του Προσωπικού: σβήνει τον υπεύθυνο (homeroomStaffId) που
 *                                           διαγράφεται, και σε τμήμα Γενικής Παιδείας τον υπεύθυνο που δεν είναι
 *                                           πια Δάσκαλος ή Ειδικότητα
 *   needsMigration(data)                    true όταν το αρχείο είναι στην παλιά μορφή τμημάτων (βλέπε κάτω)
 *   fetFile(year, message, rememberedFile)  το αρχείο FET της εισαγωγής (school-classes:fet)
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-classes:*)
 *
 * Στο .data:
 *   classesByYear[year] = {classes:[τμήμα…]}
 *   Τμήμα Γενικής Παιδείας: {id, name, grade, number, homeroomStaffId}. Το grade ('Α' … 'Στ') και το number
 *   ορίζονται στη δημιουργία και δεν αλλάζουν· το name είναι μια γραφή του κλειδιού («Α1», «Α-1»,
 *   SchoolClasses.renameError). Άλλο τμήμα (π.χ. «Τμήμα Ένταξης»): {id, name, homeroomStaffId}, χωρίς grade και
 *   number. homeroomStaffId: το id ενός εκπαιδευτικού του Προσωπικού ή ''. Τα άγνωστα πεδία (του έτους και κάθε
 *   τμήματος) διατηρούνται.
 * Όλα τα δεδομένα αναφέρονται στα τμήματα με το id: μια μετονομασία περνά παντού. Ένα τμήμα δεν αφαιρείται, και
 * δεν αλλάζει είδος, όταν έχει μαθητές, υπεύθυνο, εμφανίζεται σε πρόγραμμα ή προσχέδιο του έτους, χρησιμοποιείται
 * ως ετικέτα (_host_tags.js, που φορτώνεται μετά από αυτό· το χρησιμοποιεί τη στιγμή της κλήσης) ή βαθμολογείται σε
 * Συμβάν Ποινών / Επιβραβεύσεων του Ημερολογίου (_host_calendar.js, επίσης τη στιγμή της κλήσης).
 * Παλιά μορφή τμημάτων (needsMigration): Προσωπικό με homeroomClass, τμήμα χωρίς grade/number με όνομα τμήματος,
 * πρόγραμμα με formatVersion:1, σχέδιο του Ολοήμερου Designer με source.version:1. Ένα τέτοιο αρχείο το index
 * δεν το ανοίγει.
 */
(() => {
  'use strict';
  const T = window.SchoolTimetable, C = window.SchoolClasses, X = window.SchoolText;
  if (!T || !C || !X) throw Error('Το _host_classes.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  const APP = 'school_classes.html';
  // Όριο πλήθους: πιάνει λάθη εφαρμογών, όχι πραγματικά δεδομένα. Πάνω από το όριο η αποθήκευση απορρίπτεται·
  // από το 90% (warnRatio) η εφαρμογή δείχνει προειδοποίηση.
  const LIMITS = Object.freeze({classes: 50, warnRatio: 0.9});
  const MAX_ID = 200, MAX_NAME = 60, MAX_NUMBER = 99;
  // Οι τάξεις στη γραφή των δεδομένων (grade), και τα είδη υπηρεσίας που μπορούν να είναι υπεύθυνοι τμήματος
  // Γενικής Παιδείας.
  const GRADES = Object.freeze(['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Στ']);
  const HOMEROOM_SERVICES = Object.freeze(['classroom', 'specialty']);

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const has = (item, key) => Object.prototype.hasOwnProperty.call(item, key);
  const quoted = value => '«' + value + '»';
  const startYear = year => Number(String(year).slice(0, 4));
  const compareKey = value => X.withoutTones(value).toUpperCase().replace(/\s+/g, '');
  const staffOf = (data, year) => Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year].filter(isObject) : [];
  const plural = (count, one, many) => count + ' ' + (count === 1 ? one : many);

  // ---- Δεδομένα ----
  // Τα τμήματα ενός έτους, ή κενή λίστα. Δεν αλλάζει το data.
  function yearClasses(data, year) {
    const value = isObject(data?.classesByYear) ? data.classesByYear[year] : null;
    return Array.isArray(value?.classes) ? value.classes.filter(isObject) : [];
  }
  // Τα παλαιότερα έτη που έχουν τμήματα, για την «Εισαγωγή από παλαιότερο σχολικό έτος» (με το είδος κάθε τμήματος).
  function previousYears(data, year) {
    const byYear = isObject(data?.classesByYear) ? data.classesByYear : {};
    return Object.keys(byYear)
      .filter(other => /^\d{4}-\d{4}$/.test(other) && startYear(other) < startYear(year))
      .map(other => ({year: other, classes: C.sort(yearClasses(data, other).filter(item => typeof item.name === 'string' && item.name.trim()))}))
      .filter(item => item.classes.length)
      .sort((a, b) => startYear(b.year) - startYear(a.year));
  }

  // Τα id τμημάτων που αναφέρει το source ενός σχεδίου του Ολοήμερου Designer: κελιά (θέσεις και ελλιπή κελιά)
  // και Συνενώσεις. Το hidden δεν μετρά.
  function designClassIds(source) {
    const ids = new Set();
    if (source?.type !== 'oloimero-designer') return ids;
    const cells = list => { for (const item of Array.isArray(list) ? list : []) if (item?.type === 'class' && typeof item.id === 'string') ids.add(item.id); };
    for (const place of Object.values(isObject(source.placements) ? source.placements : {})) cells(place?.students);
    for (const item of Array.isArray(source.pending) ? source.pending : []) cells(item?.students);
    for (const union of Array.isArray(source.unions) ? source.unions : []) {
      for (const id of Array.isArray(union?.classIds) ? union.classIds : []) if (typeof id === 'string') ids.add(id);
      for (const subset of Array.isArray(union?.subsets) ? union.subsets : []) if (typeof subset?.classId === 'string' && subset.classId) ids.add(subset.classId);
    }
    return ids;
  }
  // Σε ποια προγράμματα (και προσχέδια) του έτους εμφανίζεται κάθε τμήμα: τα classes των δραστηριοτήτων και, στα
  // σχέδια του Ολοήμερου Designer, τα κελιά και οι Συνενώσεις.
  // → {[id τμήματος]: [{programId, kind, kindLabel, name, periodId, periodName, activities}]}· activities: πόσες
  //   δραστηριότητες έχουν το τμήμα (0 όταν το αναφέρει μόνο το σχέδιο, π.χ. μια Συνένωση που δεν μπήκε σε κελί).
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
        for (const id of new Set((Array.isArray(activity?.classes) ? activity.classes : []).filter(item => typeof item === 'string' && item))) counts.set(id, (counts.get(id) || 0) + 1);
      }
      for (const id of designClassIds(program.source)) if (!counts.has(id)) counts.set(id, 0);
      for (const [id, activities] of counts) (usage[id] ||= []).push({programId: program.id, kind: program.kind, kindLabel: kindLabel(program.kind), name: program.name || '', periodId: program.periodId ?? null, periodName: periodName(program.periodId), activities});
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

  // Σε ποια στοιχεία ποιας εφαρμογής χρησιμοποιείται κάθε τμήμα ως ετικέτα:
  // {[id τμήματος]: [{app, one, many, count}]}. Χωρίς το _host_tags.js → {}.
  function tagUsage(data, year) {
    const H = window.SchoolHostTags;
    return H ? H.usage(data, year).class : {};
  }

  // Σε πόσα Συμβάντα Ποινών / Επιβραβεύσεων του Ημερολογίου βαθμολογείται κάθε τμήμα:
  // {[id τμήματος]: [{app, one, many, count}]}. Χωρίς το _host_calendar.js → {}.
  function scoreUsage(data, year) {
    const Cal = window.SchoolHostCalendar;
    return Cal ? Cal.scoreUsage(data, year).class : {};
  }

  // school-classes:context: τα τμήματα του έτους, το Προσωπικό (για τον υπεύθυνο κάθε τμήματος), τα
  // παλαιότερα έτη, η χρήση στα προγράμματα και ως ετικέτα, οι μαθητές ανά τμήμα και τα όρια.
  function context(data, revision) {
    const year = data.school.year;
    return clone({
      revision, school: {...data.school}, year,
      classes: yearClasses(data, year),
      staff: staffOf(data, year),
      previousYears: previousYears(data, year),
      classUsage: classUsage(data, year),
      studentCounts: studentCounts(data, year),
      tagUsage: tagUsage(data, year),
      scoreUsage: scoreUsage(data, year),
      limits: {classes: LIMITS.classes, warnRatio: LIMITS.warnRatio}
    });
  }

  // ---- Έλεγχοι ----
  // Η λίστα τμημάτων ενός έτους. Απορρίπτει ό,τι θα χαλούσε τα δεδομένα· επιστρέφει καθαρό αντίγραφο με τα
  // άγνωστα πεδία κάθε τμήματος.
  //   staff: το Προσωπικό του έτους (για τους υπευθύνους)· options: {app (η εφαρμογή, για το μήνυμα «τελευταία
  //   έκδοση»), homerooms:false (χωρίς έλεγχο των υπευθύνων, για τα νέα τμήματα των εισαγωγών, ώστε ένας
  //   παλιός υπεύθυνος που δεν ισχύει πια να μη μπλοκάρει την εισαγωγή)}.
  function validateClasses(classes, staff = [], options = {}) {
    const newer = ' Βεβαιώσου ότι το ' + (options.app || APP) + ' είναι η τελευταία έκδοση.';
    if (!Array.isArray(classes)) throw Error('Μη έγκυρη λίστα τμημάτων.' + newer);
    if (classes.length > LIMITS.classes) throw Error('Τα Τμήματα θα είχαν ' + classes.length + ' τμήματα, πάνω από το όριο των ' + LIMITS.classes + ' ανά σχολικό έτος. Η αποθήκευση δεν έγινε· αφαίρεσε όσα δεν χρειάζονται.');
    const people = new Map((staff || []).filter(person => isObject(person) && typeof person.id === 'string').map(person => [person.id, person]));
    const ids = new Set(), keys = new Map(), names = new Map(), holders = new Map(), out = [];
    for (const item of classes) {
      if (!isObject(item)) throw Error('Μη έγκυρη εγγραφή τμήματος.' + newer);
      if (typeof item.id !== 'string' || !item.id || item.id.length > MAX_ID) throw Error('Μη έγκυρη ταυτότητα τμήματος.' + newer);
      if (ids.has(item.id)) throw Error('Βρέθηκαν διπλές ταυτότητες τμημάτων.' + newer);
      ids.add(item.id);
      if (typeof item.name !== 'string' || !item.name.trim()) throw Error('Το όνομα τμήματος είναι υποχρεωτικό.');
      if (item.name.length > MAX_NAME) throw Error('Το όνομα τμήματος ' + quoted(item.name.slice(0, MAX_NAME) + '…') + ' είναι πολύ μεγάλο (έως ' + MAX_NAME + ' χαρακτήρες).');
      const name = quoted(item.name);
      if (has(item, 'grade') || has(item, 'number')) {
        // Τμήμα Γενικής Παιδείας: έγκυρα grade και number, και όνομα που είναι γραφή του κλειδιού.
        if (!GRADES.includes(item.grade) || !Number.isInteger(item.number) || item.number < 1 || item.number > MAX_NUMBER) throw Error('Το τμήμα ' + name + ' δεν έχει έγκυρη τάξη και αριθμό.' + newer);
        const key = C.key(item);
        if (C.renameError(item, item.name)) throw Error('Το όνομα ' + name + ' δεν ταιριάζει με το τμήμα ' + key + '. ' + C.renameError(item, item.name));
        if (keys.has(key)) throw Error('Το τμήμα ' + key + ' υπάρχει δύο φορές (' + quoted(keys.get(key)) + ', ' + name + ').');
        keys.set(key, item.name);
      } else if (T.classSpelling(item.name)) {
        throw Error('Το ' + name + ' είναι όνομα τμήματος Γενικής Παιδείας. Ένα τέτοιο τμήμα προστίθεται ως τμήμα Γενικής Παιδείας (τάξη και αριθμός).');
      }
      const plain = compareKey(item.name);
      if (names.has(plain)) throw Error('Το τμήμα ' + name + ' υπάρχει δύο φορές.');
      names.set(plain, item.id);
      const homeroom = item.homeroomStaffId ?? '';
      if (typeof homeroom !== 'string' || homeroom.length > 1000) throw Error('Μη έγκυρος υπεύθυνος του τμήματος ' + name + '.' + newer);
      if (homeroom && options.homerooms !== false) {
        const person = people.get(homeroom);
        if (!person) throw Error('Ο υπεύθυνος του τμήματος ' + name + ' δεν υπάρχει στο Προσωπικό του σχολικού έτους.');
        if (C.isGeneral(item) && !HOMEROOM_SERVICES.includes(person.serviceType)) throw Error('Ο/Η ' + quoted(person.shortName || person.name || person.code || '') + ' δεν μπορεί να είναι υπεύθυνος του τμήματος ' + name + ': υπεύθυνος τμήματος Γενικής Παιδείας είναι μόνο Δάσκαλος ή Ειδικότητα (Είδος υπηρεσίας στο Προσωπικό).');
        if (holders.has(homeroom)) throw Error('Ο/Η ' + quoted(person.shortName || person.name || person.code || '') + ' είναι υπεύθυνος δύο τμημάτων (' + quoted(holders.get(homeroom)) + ', ' + name + '). Ένας εκπαιδευτικός είναι υπεύθυνος το πολύ ενός τμήματος.');
        holders.set(homeroom, item.name);
      }
      out.push(clone(item));
    }
    return out;
  }

  // Τα δεδομένα ενός τμήματος που εμποδίζουν την αφαίρεση και την αλλαγή είδους: μαθητές, υπεύθυνος, προγράμματα,
  // χρήση ως ετικέτα, βαθμολογία σε συμβάντα. → κείμενο («2 μαθητές, υπεύθυνο, 1 πρόγραμμα») ή ''.
  function classDataText(record, counts, usage, homeroom, tags = {}, scores = {}) {
    const parts = [];
    if (counts[record.id]) parts.push(plural(counts[record.id], 'μαθητή', 'μαθητές'));
    if (homeroom) parts.push('υπεύθυνο');
    if (usage[record.id]?.length) parts.push('χρήση σε ' + plural(usage[record.id].length, 'πρόγραμμα ή προσχέδιο', 'προγράμματα ή προσχέδια') + ' (' + usage[record.id].map(item => item.kindLabel + ' – ' + (item.periodId ? (item.periodName || 'περίοδος') : 'προσχέδιο') + (item.name ? ' ' + quoted(item.name) : '')).join(', ') + ')');
    if (tags[record.id]?.length) parts.push('χρήση ως ετικέτα σε ' + tags[record.id].map(item => item.count + ' ' + (item.count === 1 ? item.one : item.many)).join(', '));
    if (scores[record.id]?.length) parts.push('βαθμολογία σε ' + scores[record.id].map(item => item.count + ' ' + (item.count === 1 ? item.one : item.many)).join(', '));
    return parts.join(', ');
  }

  // Το school-classes:save σε αντίγραφο του data: αντικαθιστά μόνο τη λίστα του classesByYear[year]. Τα άλλα έτη
  // και τα άγνωστα πεδία του έτους μένουν όπως είναι. Απορρίπτει την αφαίρεση και την αλλαγή είδους τμήματος που
  // έχει δεδομένα (μαθητές, υπεύθυνο, χρήση σε πρόγραμμα ή προσχέδιο ή ως ετικέτα, βαθμολογία σε συμβάν), και αλλαγή
  // τάξης ή αριθμού.
  function applySave(data, message) {
    const year = data.school.year, classes = validateClasses(message?.classes, staffOf(data, year)), candidate = clone(data);
    const existing = new Map(yearClasses(data, year).map(item => [item.id, item]));
    const counts = studentCounts(data, year), usage = classUsage(data, year), tags = tagUsage(data, year), scores = scoreUsage(data, year), next = new Map(classes.map(item => [item.id, item]));
    const lost = [];
    for (const [id, old] of existing) {
      const now = next.get(id);
      if (!now) {
        const text = classDataText(old, counts, usage, old.homeroomStaffId, tags, scores);
        if (text) lost.push(quoted(old.name) + ': ' + text);
        continue;
      }
      if (C.isGeneral(old) && C.isGeneral(now) && C.key(old) !== C.key(now)) throw Error('Το τμήμα ' + quoted(old.name) + ' δεν μπορεί να γίνει ' + C.key(now) + ': η τάξη και ο αριθμός ενός τμήματος δεν αλλάζουν. Για νέο τμήμα χρησιμοποίησε «+ Προσθήκη».');
      if (C.isGeneral(old) !== C.isGeneral(now)) {
        const text = classDataText(old, counts, usage, old.homeroomStaffId || now.homeroomStaffId, tags, scores);
        if (text) throw Error('Το είδος του τμήματος ' + quoted(old.name) + ' δεν αλλάζει, γιατί έχει ' + text + '.');
      }
    }
    if (lost.length) throw Error((lost.length === 1 ? 'Το τμήμα δεν αφαιρείται, γιατί έχει δεδομένα: ' : 'Τα τμήματα δεν αφαιρούνται, γιατί έχουν δεδομένα: ') + lost.join('· ') + '. Μετάφερε πρώτα τους μαθητές από τους «Μαθητές», βγάλε τον υπεύθυνο, διόρθωσε τα προγράμματα, αφαίρεσε τις ετικέτες και βγάλε το τμήμα από τις Ποινές / Επιβραβεύσεις του Σχολικού Ημερολογίου.');
    if (!isObject(candidate.classesByYear)) candidate.classesByYear = {};
    const previous = isObject(candidate.classesByYear[year]) ? candidate.classesByYear[year] : {};
    candidate.classesByYear[year] = {...previous, classes};
    return candidate;
  }

  // Τα νέα τμήματα μιας εισαγωγής (analysis.newClasses), που φέρνει το school-timetables:save ή το
  // school-students:save, στο classesByYear[year] του candidate (αντίγραφο του data). Μόνο τμήματα Γενικής
  // Παιδείας, νέα (χωρίς id υπάρχοντος) και χωρίς υπεύθυνο, με τους ελέγχους της λίστας και το όριο πλήθους.
  //   app: η εφαρμογή, για το μήνυμα «τελευταία έκδοση». → όλα τα τμήματα του έτους μετά την προσθήκη.
  function addClasses(candidate, year, added, app) {
    const newer = ' Βεβαιώσου ότι το ' + app + ' είναι η τελευταία έκδοση.';
    const existing = yearClasses(candidate, year);
    if (added == null) return existing;
    if (!Array.isArray(added)) throw Error('Μη έγκυρη λίστα νέων τμημάτων.' + newer);
    if (!added.length) return existing;
    const known = new Set(existing.map(item => item.id));
    if (added.some(item => !isObject(item) || known.has(item.id))) throw Error('Μια εισαγωγή μπορεί μόνο να προσθέσει τμήματα, όχι να αλλάξει υπάρχοντα.' + newer);
    if (added.some(item => !has(item, 'grade') && !has(item, 'number'))) throw Error('Μια εισαγωγή δημιουργεί μόνο τμήματα Γενικής Παιδείας· τα άλλα τμήματα προστίθενται στα «Τμήματα».' + newer);
    if (added.some(item => item.homeroomStaffId)) throw Error('Τα νέα τμήματα μιας εισαγωγής δεν έχουν υπεύθυνο· ο υπεύθυνος ορίζεται στα «Τμήματα».' + newer);
    validateClasses([...existing, ...added], [], {app, homerooms: false});
    const classes = [...existing.map(clone), ...validateClasses(added, [], {app, homerooms: false})];
    if (!isObject(candidate.classesByYear)) candidate.classesByYear = {};
    const previous = isObject(candidate.classesByYear[year]) ? candidate.classesByYear[year] : {};
    candidate.classesByYear[year] = {...previous, classes};
    return classes;
  }

  // Αποθήκευση του Προσωπικού (στο data, που είναι ήδη αντίγραφο με το νέο Προσωπικό): σβήνει το homeroomStaffId
  //   - των εκπαιδευτικών που διαγράφονται (removedIds), σε όλα τα τμήματα του έτους,
  //   - σε τμήμα Γενικής Παιδείας, του υπευθύνου που δεν είναι πια Δάσκαλος ή Ειδικότητα (αλλαγή του Είδους
  //     υπηρεσίας στο Προσωπικό). Στα άλλα τμήματα (π.χ. «Τμήμα Ένταξης») ο υπεύθυνος μένει.
  // → πόσα τμήματα άλλαξαν.
  function removeStaff(data, year, removedIds) {
    const removed = new Set(removedIds || []), classes = yearClasses(data, year);
    if (!classes.length) return 0;
    const people = new Map(staffOf(data, year).filter(person => typeof person.id === 'string').map(person => [person.id, person]));
    const loses = item => {
      const id = item.homeroomStaffId;
      if (typeof id !== 'string' || !id) return false;
      if (removed.has(id)) return true;
      const person = people.get(id);
      return C.isGeneral(item) && !!person && !HOMEROOM_SERVICES.includes(person.serviceType);
    };
    if (!classes.some(loses)) return 0;
    let changed = 0;
    data.classesByYear[year] = {...data.classesByYear[year], classes: data.classesByYear[year].classes.map(item => {
      if (!isObject(item) || !loses(item)) return item;
      changed++;
      return {...item, homeroomStaffId: ''};
    })};
    return changed;
  }

  // Το αρχείο είναι στην παλιά μορφή τμημάτων (πριν από τα τμήματα με id); Τότε το index δεν το ανοίγει:
  // Προσωπικό με homeroomClass, τμήμα χωρίς grade/number με όνομα τμήματος, πρόγραμμα με formatVersion:1,
  // σχέδιο του Ολοήμερου Designer με source.version:1.
  function needsMigration(data) {
    const values = value => isObject(value) ? Object.values(value) : [];
    for (const staff of values(data?.staffByYear)) {
      if (Array.isArray(staff) && staff.some(person => isObject(person) && has(person, 'homeroomClass'))) return true;
    }
    for (const year of values(data?.classesByYear)) {
      if (Array.isArray(year?.classes) && year.classes.some(item => isObject(item) && !has(item, 'grade') && !has(item, 'number') && T.classSpelling(item.name))) return true;
    }
    for (const year of values(data?.timetablesByYear)) {
      for (const program of Array.isArray(year?.programs) ? year.programs : []) {
        if (!isObject(program)) continue;
        if (typeof program.formatVersion === 'number' && program.formatVersion < 2) return true;
        if (program.source?.type === 'oloimero-designer' && program.source.version !== 2) return true;
      }
    }
    return false;
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
    APP, LIMITS, yearClasses, previousYears, classUsage, studentCounts, tagUsage, scoreUsage, context, validateClasses, applySave, addClasses,
    removeStaff, needsMigration, fetFile, install
  });
})();
