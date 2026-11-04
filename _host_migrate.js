/*
 * Εφαρμογές σχολείου — Μετατροπή του κοινού αρχείου στη νέα μορφή τμημάτων (host, προσωρινό)
 * Έκδοση αρχείου: 0.01
 * Όνομα κατά την εγκατάσταση: _host_migrate.js
 *
 * Προσωρινός κώδικας του host: μετατρέπει ένα κοινό αρχείο της παλιάς μορφής τμημάτων (τμήματα με το όνομα,
 * υπεύθυνος τμήματος στο Προσωπικό) στη νέα (τμήματα με id στο classesByYear, υπεύθυνος στα Τμήματα). Το φορτώνει
 * μόνο το index.html, μετά το _data.js και τα _host_*.js: <script src="_host_migrate.js"></script>· και το
 * data_test.html, για να ελέγξει τη μετατροπή. Αφαιρείται όταν όλα τα αρχεία έχουν μετατραπεί· τότε ένα αρχείο
 * της παλιάς μορφής δεν ανοίγει (SchoolHostClasses.needsMigration, στο index).
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostMigrate:
 *   migrate(data)       → {data, report}: νέο αντίγραφο του data στη νέα μορφή (το αρχικό δεν αλλάζει) και τι
 *                         έγινε ανά σχολικό έτος. Πετά λάθος όταν η μετατροπή δεν μπορεί να γίνει.
 *   summary(report)     → οι γραμμές του μηνύματος προς τον χρήστη.
 *
 * Για κάθε σχολικό έτος:
 *   1. Τμήματα: τα υπάρχοντα του classesByYear παίρνουν grade και number από το όνομα (και κενό
 *      homeroomStaffId). Όσα λείπουν δημιουργούνται, με το SchoolClasses.resolver, από τους υπευθύνους του
 *      Προσωπικού και από τα ονόματα των προγραμμάτων (μόνο ονόματα σε γραφή τμήματος).
 *   2. Υπεύθυνος: το homeroomClass του Προσωπικού γίνεται homeroomStaffId του τμήματος και φεύγει από το
 *      Προσωπικό. Δεν μεταφέρεται, με αναφορά στο μήνυμα, όταν ο εκπαιδευτικός δεν είναι Δάσκαλος ή Ειδικότητα,
 *      όταν το τμήμα έχει ήδη υπεύθυνο ή όταν ο εκπαιδευτικός είναι ήδη υπεύθυνος άλλου τμήματος.
 *   3. Προγράμματα (formatVersion:1 → 2): τα classes γίνονται id· ό,τι δεν είναι τμήμα μπαίνει στο otherStudents·
 *      στα subsets τα ολόκληρα τμήματα (του κανόνα των μεικτών δραστηριοτήτων) γίνονται id, ενώ τα ονόματα ομάδων
 *      του FET («Ε1-Γαλ») μένουν κείμενο. Το source του FET μένει όπως ήρθε από το αρχείο.
 *   4. Σχέδια του Ολοήμερου Designer (source.version:1 → 2): τα Τμήματα του Designer (departments) καταργούνται·
 *      τα κελιά γίνονται Τάξη, Τμήμα ή Συνένωση, και οι Συνενώσεις παίρνουν grades, classIds, subsets και
 *      otherStudents, με τους κανόνες της εισαγωγής CSV για τις μορφές v1–v3 (SchoolTimetable.oloimeroCells).
 *      Το hidden μένει κενό: όλες οι Τάξεις και τα Τμήματα φαίνονται στη μπάρα. Οι μαθητές των δραστηριοτήτων
 *      υπολογίζονται ξανά από τα κελιά (SchoolTimetable.oloimeroStudents).
 * Οι μαθητές (studentsByYear) κρατούν ήδη το id του τμήματος και δεν αλλάζουν.
 */
(() => {
  'use strict';
  const T = window.SchoolTimetable, C = window.SchoolClasses, K = window.SchoolHostClasses;
  if (!T || !C || !K) throw Error('Το _host_migrate.js χρειάζεται το _data.js και το _host_classes.js, φορτωμένα πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  const HOMEROOM_SERVICES = ['classroom', 'specialty'];
  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const has = (item, key) => Object.prototype.hasOwnProperty.call(item, key);
  const unique = list => [...new Set(list)];
  const quoted = value => '«' + value + '»';
  const texts = value => (Array.isArray(value) ? value : []).map(item => String(item ?? '').trim()).filter(Boolean);
  const personName = person => String(person.shortName || person.name || person.code || '').trim() || 'χωρίς όνομα';

  // Τα σχολικά έτη του αρχείου: όσα έχουν Προσωπικό, Τμήματα ή προγράμματα.
  function yearsOf(data) {
    const keys = ['staffByYear', 'classesByYear', 'timetablesByYear'].flatMap(key => isObject(data[key]) ? Object.keys(data[key]) : []);
    return unique(keys).sort();
  }

  // Τάξη και αριθμός από το όνομα ενός τμήματος της παλιάς μορφής («Στ1» → {grade:'Στ', number:1}), ή null.
  function gradeNumber(name) {
    const match = /^(Στ|[ΑΒΓΔΕ])(\d+)$/.exec(T.classSpelling(name));
    return match ? {grade: match[1], number: Number(match[2])} : null;
  }

  // Ένα σχέδιο του Ολοήμερου Designer της παλιάς μορφής (source.version:1, με departments) στη νέα.
  function migrateDesign(program, resolver) {
    const source = program.source;
    const departments = new Map((Array.isArray(source.departments) ? source.departments : []).filter(isObject).map(item => [item.id, String(item.name ?? '').trim()]));
    const oldUnions = (Array.isArray(source.unions) ? source.unions : []).filter(isObject);
    const unionNames = new Map(oldUnions.map(item => [item.id, String(item.name ?? '').trim()]));
    // Οι Συνενώσεις στη μορφή v1–v3 της εισαγωγής CSV: με τα ονόματα των Τμημάτων του Designer που περιείχαν.
    const saved = oldUnions.map(item => ({id: item.id, name: item.name, departments: texts((Array.isArray(item.departmentIds) ? item.departmentIds : []).map(id => departments.get(id)))}));
    const {unions, cell} = T.oloimeroCells(resolver, saved);
    // Τα στοιχεία ενός κελιού: ένα Τμήμα του Designer ή μια Συνένωση, με το όνομά τους.
    const items = list => {
      const out = [];
      for (const item of Array.isArray(list) ? list : []) {
        const name = item?.type === 'department' ? departments.get(item.id) : item?.type === 'union' ? unionNames.get(item.id) : '';
        for (const part of name ? cell(name) : []) if (!out.some(other => JSON.stringify(other) === JSON.stringify(part))) out.push(part);
      }
      return out;
    };
    const placements = {};
    for (const [id, place] of Object.entries(isObject(source.placements) ? source.placements : {})) placements[id] = isObject(place) ? {...place, students: items(place.students)} : place;
    const pending = (Array.isArray(source.pending) ? source.pending : []).map(item => isObject(item) ? {...item, students: items(item.students)} : item);
    const {departments: dropped, ...rest} = source;
    program.source = {...rest, version: 2, unions: clone(unions), hidden: {grades: [], classes: []}, placements, pending};
    // Οι μαθητές κάθε δραστηριότητας από τα κελιά, όπως στην αποθήκευση του Designer.
    for (const activity of program.activities) {
      const place = placements[activity?.id];
      if (!isObject(activity) || !isObject(place)) continue;
      const students = T.oloimeroStudents(place.students, {unions}, resolver);
      activity.classes = [...students.classes]; activity.subsets = [...students.subsets]; activity.otherStudents = [...students.otherStudents];
    }
  }

  // Ένα σχολικό έτος του candidate (αντίγραφο), στη θέση του. → η αναφορά του έτους.
  function migrateYear(candidate, year) {
    const report = {year, created: [], homerooms: 0, skipped: [], programs: 0, designs: 0, otherStudents: []};
    const previous = isObject(candidate.classesByYear?.[year]) ? candidate.classesByYear[year] : null;
    // 1. Τα υπάρχοντα τμήματα: grade και number από το όνομα.
    const list = (Array.isArray(previous?.classes) ? previous.classes : []).filter(isObject).map(item => {
      const record = {...item};
      if (!has(record, 'grade') && !has(record, 'number')) {
        const parts = gradeNumber(record.name);
        if (parts) Object.assign(record, parts);
      }
      if (record.homeroomStaffId == null) record.homeroomStaffId = '';
      return record;
    });
    const resolver = C.resolver(list, {limit: K.LIMITS.classes});
    const byId = id => resolver.classes.find(item => item.id === id);

    // 2. Υπεύθυνοι: από το Προσωπικό στα Τμήματα.
    const staff = Array.isArray(candidate.staffByYear?.[year]) ? candidate.staffByYear[year] : null;
    const holders = new Set(resolver.classes.map(item => item.homeroomStaffId).filter(Boolean));
    for (const person of staff || []) {
      if (!isObject(person) || !has(person, 'homeroomClass')) continue;
      const value = String(person.homeroomClass ?? '').trim();
      delete person.homeroomClass;
      if (!value) continue;
      const id = resolver.resolve(value), record = id && byId(id);
      if (!record) { report.skipped.push(quoted(personName(person)) + ': το ' + quoted(value) + ' δεν είναι τμήμα'); continue; }
      if (!HOMEROOM_SERVICES.includes(person.serviceType)) { report.skipped.push(quoted(personName(person)) + ' (' + record.name + '): δεν είναι Δάσκαλος ή Ειδικότητα'); continue; }
      if (record.homeroomStaffId && record.homeroomStaffId !== person.id) { report.skipped.push(quoted(personName(person)) + ' (' + record.name + '): το τμήμα έχει ήδη υπεύθυνο'); continue; }
      if (record.homeroomStaffId === person.id) continue;
      if (holders.has(person.id)) { report.skipped.push(quoted(personName(person)) + ' (' + record.name + '): είναι ήδη υπεύθυνος άλλου τμήματος'); continue; }
      record.homeroomStaffId = person.id; holders.add(person.id); report.homerooms++;
    }

    // 3–4. Προγράμματα και σχέδια.
    const timetables = isObject(candidate.timetablesByYear?.[year]) ? candidate.timetablesByYear[year] : null;
    for (const program of Array.isArray(timetables?.programs) ? timetables.programs : []) {
      if (!isObject(program) || !Array.isArray(program.activities)) continue;
      const oldProgram = typeof program.formatVersion === 'number' && program.formatVersion < 2;
      const oldDesign = program.source?.type === 'oloimero-designer' && program.source.version !== 2;
      if (!oldProgram && !oldDesign) continue;
      if (oldProgram) {
        for (const activity of program.activities) {
          if (!isObject(activity)) continue;
          const ids = [], other = texts(activity.otherStudents);
          for (const name of texts(activity.classes)) { const id = resolver.resolve(name); if (id) ids.push(id); else other.push(name); }
          activity.classes = unique(ids);
          activity.subsets = unique(texts(activity.subsets).map(name => (T.classSpelling(name) && resolver.resolve(name)) || name));
          activity.otherStudents = unique(other);
          report.otherStudents.push(...activity.otherStudents);
        }
        program.formatVersion = 2;
        report.programs++;
      }
      if (oldDesign) {
        migrateDesign(program, resolver); report.designs++;
        report.otherStudents.push(...program.source.unions.flatMap(union => union.otherStudents));
      }
    }
    if (resolver.overLimit.length) throw Error('Η μετατροπή του σχολικού έτους ' + year + ' θα δημιουργούσε τα τμήματα ' + resolver.overLimit.join(', ') + ', πάνω από το όριο των ' + K.LIMITS.classes + ' τμημάτων. Το αρχείο δεν άνοιξε.');

    report.created = C.sort(resolver.newClasses).map(item => item.name);
    report.otherStudents = unique(report.otherStudents);
    if (previous || resolver.classes.length) {
      if (!isObject(candidate.classesByYear)) candidate.classesByYear = {};
      candidate.classesByYear[year] = {...(previous || {}), classes: C.sort(resolver.classes)};
    }
    return report;
  }

  function migrate(data) {
    if (!isObject(data)) throw Error('Μη έγκυρα κοινά δεδομένα.');
    const candidate = clone(data);
    const years = yearsOf(candidate).map(year => migrateYear(candidate, year));
    return {data: candidate, report: {years: years.filter(item => item.created.length || item.homerooms || item.skipped.length || item.programs || item.designs)}};
  }

  // Το μήνυμα προς τον χρήστη: τι άλλαξε σε κάθε σχολικό έτος.
  function summary(report) {
    const lines = ['Το αρχείο ήταν στην παλιά μορφή τμημάτων και μετατράπηκε στη νέα: τα τμήματα έχουν πλέον δική τους ταυτότητα στα «Τμήματα», και ο υπεύθυνος κάθε τμήματος ορίζεται εκεί και όχι στο Προσωπικό.'];
    for (const item of report?.years || []) {
      const parts = [];
      if (item.created.length) parts.push('δημιουργήθηκαν ' + (item.created.length === 1 ? 'το τμήμα ' : 'τα τμήματα ') + item.created.join(', '));
      if (item.homerooms) parts.push(item.homerooms === 1 ? '1 υπεύθυνος τμήματος μεταφέρθηκε από το Προσωπικό στα «Τμήματα»' : item.homerooms + ' υπεύθυνοι τμημάτων μεταφέρθηκαν από το Προσωπικό στα «Τμήματα»');
      const designs = item.designs ? (item.designs === 1 ? '1 σχέδιο' : item.designs + ' σχέδια') + ' του Ολοημέρου' : '';
      if (item.programs) parts.push((item.programs === 1 ? '1 πρόγραμμα μετατράπηκε' : item.programs + ' προγράμματα μετατράπηκαν') + ' στη νέα μορφή' + (designs ? ' (από αυτά ' + designs + ')' : ''));
      else if (designs) parts.push(designs + (item.designs === 1 ? ' μετατράπηκε' : ' μετατράπηκαν') + ' στη νέα μορφή');
      if (item.designs) parts.push('οι Τάξεις και τα Τμήματα της αριστερής μπάρας του Ολοήμερου Designer έρχονται πλέον από τα «Τμήματα» και φαίνονται όλα· όσα δεν χρειάζονται κρύβονται με το μολυβάκι');
      lines.push(item.year + ': ' + (parts.join('· ') || 'καμία αλλαγή') + '.');
      if (item.skipped.length) lines.push(item.year + ', δεν μεταφέρθηκε ο υπεύθυνος: ' + item.skipped.join('· ') + '. Όρισέ τον στα «Τμήματα».');
      if (item.otherStudents.length) lines.push(item.year + ', ονόματα μαθητών που δεν είναι τμήματα (μένουν ως κείμενο): ' + item.otherStudents.map(quoted).join(', ') + '.');
    }
    return lines;
  }

  window.SchoolHostMigrate = Object.freeze({migrate, summary});
})();
