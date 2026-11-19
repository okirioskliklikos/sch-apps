/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων: Ολοήμερο
 * Έκδοση αρχείου: 0.06
 * Όνομα κατά την εγκατάσταση: _data_oloimero.js
 *
 * Ο κοινός κώδικας δεδομένων είναι σε τέσσερα αρχεία, που φορτώνονται πάντα όλα, με αυτή τη σειρά, μετά το _ui.js
 * και πριν από το δικό τους script (στο index πριν από τα _host_*.js):
 *   <script src="_data.js"></script>
 *   <script src="_data_timetable.js"></script>
 *   <script src="_data_oloimero.js"></script>
 *   <script src="_data_documents.js"></script>
 * Δεν έχουν δικό τους περιβάλλον χρήστη: δεν ανοίγουν διαλόγους και δεν γράφουν στη σελίδα. Κάθε αρχείο ελέγχει ότι
 * φορτώθηκαν πριν από αυτό τα προηγούμενα, και αλλιώς σταματά με μήνυμα που λέει ποιο λείπει.
 * Χρειάζεται τα _data.js και _data_timetable.js.
 * Προσθέτει στο window.SchoolTimetable, και μετά το παγώνει:
 *   σχέδια του Ολοήμερου Designer (ώρες, μαθητές των κελιών από ονόματα, χρώμα εκπαιδευτικού, γραμμές σχεδίου), το
 *   CSV του Ολοημέρου για το FET (ανάγνωση και εξαγωγή), τον εισαγωγέα «CSV Ολοημέρου» του είδους oloimero (kinds.oloimero.importers), και το
 *   σχέδιο Ολοημέρου στην εισαγωγή FET (σύγκριση των σχεδίων με το Ωρολόγιο: oloimeroDesignMatches· αυτόματη
 *   δημιουργία σχεδίου από το Ωρολόγιο: oloimeroDesignFromSchool), και την εγγραφή Ιστορικού μιας αποθήκευσης
 *   του Designer (oloimeroHistoryEdit).
 * Τα προγράμματα είναι στη μορφή formatVersion:2: οι δραστηριότητες αναφέρονται στα τμήματα με το id τους
 * (classes), και τα ονόματα μαθητών των αρχείων που δεν είναι τμήματα μπαίνουν στο otherStudents.
 */
(() => {
  'use strict';
  const parts = window.SchoolDataParts;
  if (!parts) throw Error('Λείπει το αρχείο _data.js, που φορτώνεται πριν από το _data_oloimero.js. Βεβαιώσου ότι η σελίδα φορτώνει τα _data.js, _data_timetable.js, _data_oloimero.js και _data_documents.js, με αυτή τη σειρά, και ότι είναι η τελευταία έκδοση.');
  parts.needs('_data_oloimero.js', ['_data.js', '_data_timetable.js']);
  const {BOM, parse, quote, compareKey, DAY_KEYS, DAY_LABELS, uid, clone, unique, nowIso, quoted, isObject,
    timedHours, GRADES, GRADE_LABELS, gradeKey, gradeName, isGeneralClass, classKey, sortClasses, classesById,
    classNameOf, classGrades, classResolver, combineStudents, subsetParent, studentsParts, expandGrade, studentsText,
    tagSets, tagsOf, isGeneralTeacher, sortStaff, OLOIMERO_CATEGORIES} = parts;

  // ---- CSV του Ολοήμερου Designer ----
  // CSV του Ολοήμερου Designer → γραμμές σχεδίου. Οι γραμμές σχολίων («#») και η ενσωματωμένη
  // περιγραφή JSON παραλείπονται. → [{line, studentsSets, subject, teachers:[…], tags:[…]}].
  function oloimeroRowsFromCsv(textValue) {
    const lines = String(textValue ?? '').replace(BOM, '').split(/\r?\n/);
    const kept = [], lineNumbers = [];
    lines.forEach((line, index) => { if (line.trim() && !line.trimStart().startsWith('#')) { kept.push(line); lineNumbers.push(index + 1); } });
    const rows = parse(kept.join('\n'), {delimiter: ','});
    if (!rows.length) throw Error('Το CSV του Ολοήμερου δεν έχει γραμμές.');
    const header = rows[0].map(value => value.trim());
    const column = name => header.indexOf(name);
    const columns = {students: column('Students Sets'), subject: column('Subject'), teachers: column('Teachers'), tags: column('Activity Tags')};
    if (Object.values(columns).some(value => value < 0)) throw Error('Το αρχείο δεν είναι CSV του Ολοήμερου Designer: λείπουν οι στήλες «Students Sets», «Subject», «Teachers» ή «Activity Tags».');
    return rows.slice(1).map((row, index) => ({
      line: lineNumbers[index + 1],
      studentsSets: (row[columns.students] || '').trim(),
      subject: (row[columns.subject] || '').trim(),
      teachers: tagsOf(row[columns.teachers]),
      tags: tagsOf(row[columns.tags])
    }));
  }

  // =============================================================================================
  // ---- Σχέδια του Ολοήμερου Designer (kind 'oloimero', source.type 'oloimero-designer') ----
  // =============================================================================================
  // Το πρόγραμμα έχει τις κοινές δραστηριότητες (μία ανά πλήρες κελί: εκπαιδευτικός, μάθημα, μαθητές, ώρα).
  // Το source κρατά ό,τι χρειάζεται ο Designer για να ξαναδείξει τον ίδιο πίνακα:
  //   version: 2, csvName, importedAt (όταν προήλθε από εισαγωγή),
  //   design:   {hours:[{hourId, count, exceptionsEnabled, dayCounts:[Δε, Τρ, Τε, Πε, Πα]}]}: πόσα κελιά έχει
  //             κάθε ώρα (Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο) ανά ημέρα,
  //   teachers: [{staffId|null, name, color, availableHours}]: οι εκπαιδευτικοί της αριστερής μπάρας
  //             (name: το σύντομο όνομα· για όσους δεν αντιστοιχίστηκαν, το όνομα του αρχείου),
  //   subjects: [{id, name}],
  //   unions:   [{id, name, grades:['Α'…'Στ'], classIds:[id…], subsets:[{name, classId}], otherStudents:[…]}]:
  //             οι Συνενώσεις του χρήστη. Οι Τάξεις και τα Τμήματα της μπάρας δεν αποθηκεύονται: έρχονται
  //             από τα Τμήματα του έτους, και μια τάξη (και μια Συνένωση με τάξεις) έχει πάντα τα τμήματα
  //             που υπάρχουν τώρα,
  //   hidden:   {grades:['Α'…], classes:[id…]}: Τάξεις και Τμήματα που δεν φαίνονται στη μπάρα,
  //   styles:   {teacher, subject, department (Τάξεις και Τμήματα), union}: {fontSize, bold, italic},
  //   placements: {[activityId]: {hourId, day (1–5), slot, students:[{type:'grade', grade} | {type:'class', id} |
  //             {type:'union', id}]}}: η θέση κάθε δραστηριότητας στον πίνακα και οι μαθητές του κελιού,
  //   pending:  [{hourId, day, slot, staffId|null, name, subjectId|null, students}]: τα ελλιπή κελιά (δεν
  //             είναι δραστηριότητες, δεν μετρούν και δεν βγαίνουν στο CSV).
  // Οι εκπαιδευτικοί και το μάθημα κάθε δραστηριότητας διαβάζονται από τη δραστηριότητα (staff, unmatched,
  // subject), όχι από το source, ώστε να ισχύουν οι αλλαγές του host σε διαγραφή εκπαιδευτικού. Τα classes /
  // subsets / otherStudents της δραστηριότητας είναι οι μαθητές του κελιού, αναπτυγμένοι στην αποθήκευση.
  // OLOIMERO_CATEGORIES (Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο): στο _data_timetable.js, για τη σύνθεση της περιόδου.
  const OLOIMERO_MAX_SLOTS = 20;
  const OLOIMERO_COLORS = Object.freeze({general: '#fff2a8', other: '#bfe3ff'});
  const OLOIMERO_STYLE_KEYS = Object.freeze(['teacher', 'subject', 'department', 'union']);
  const OLOIMERO_CSV_HEADER = '"Students Sets","Subject","Teachers","Activity Tags","Total Duration","Split Duration","Min Days","Weight","Consecutive","Comments"';
  const OLOIMERO_JSON_BEGIN = '# OLOIMERO_DESIGNER_JSON_BEGIN', OLOIMERO_JSON_END = '# OLOIMERO_DESIGNER_JSON_END';
  const clampCount = value => Math.max(0, Math.min(OLOIMERO_MAX_SLOTS, Math.floor(Number(value) || 0)));
  const validColor = value => /^#[0-9a-f]{6}$/i.test(String(value ?? ''));
  const designStyle = value => ({fontSize: Math.max(8, Math.min(48, Math.round(Number(value?.fontSize) || 16))), bold: value?.bold !== false, italic: !!value?.italic});
  // Προεπιλεγμένο χρώμα κάρτας: κίτρινο για τους δασκάλους (ΠΕ70), γαλάζιο για τους υπόλοιπους.
  const oloimeroTeacherColor = person => person && isGeneralTeacher(person) ? OLOIMERO_COLORS.general : OLOIMERO_COLORS.other;

  // Οι ώρες των Ωρών Διδασκαλίας που έχει ο πίνακας του Designer (Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο).
  const oloimeroHours = teachingHours => timedHours(teachingHours).filter(item => OLOIMERO_CATEGORIES.includes(item.category));
  const oloimeroZone = category => category === 'early' ? 'morning' : category === 'extended' ? 'extended' : 'day';
  // Η γραφή ενός τμήματος στα αρχεία (CSV για το FET): το κλειδί για τμήμα Γενικής Παιδείας («Α1», όχι «Α-1»),
  // το όνομα για άλλο τμήμα.
  const classFileName = record => record ? (classKey(record) || String(record.name ?? '')) : '';
  const validGrades = list => unique((Array.isArray(list) ? list : []).map(gradeKey).filter(grade => GRADES.includes(grade)).map(gradeName));

  // Οι μαθητές ενός κελιού → {text, classes, subsets, otherStudents}. text: τα ονόματα ενωμένα με «+», όπως τα
  // γράφει η στήλη «Students Sets» του CSV για το FET (τάξη «Β'», τμήμα Γενικής Παιδείας με το κλειδί, άλλο
  // τμήμα με το όνομά του, Συνένωση με το όνομά της).
  //   items: [{type:'grade', grade} | {type:'class', id} | {type:'union', id}]· lists: {unions} (του source)·
  //   classes: τα Τμήματα του έτους (ή SchoolClasses.resolver). Μια τάξη αναπτύσσεται στα τμήματα που υπάρχουν·
  //   τάξη χωρίς τμήματα → το όνομά της στο otherStudents.
  // Δέχεται κάθε τμήμα (και όσα δεν είναι Γενικής Παιδείας, π.χ. Τμήμα Ένταξης)· τον περιορισμό σε τμήματα Γενικής
  // Παιδείας τον κάνει ο Ολοήμερος Designer. Τη χρησιμοποιούν και τα Ατομικά Προγράμματα (chips των κελιών).
  function oloimeroStudents(items, lists, classes) {
    const resolver = classResolver(classes), byId = classesById(resolver.classes);
    const unions = new Map((lists?.unions || []).filter(isObject).map(item => [item.id, item]));
    const texts = [], whole = [], subsets = [], other = [];
    for (const item of items || []) {
      if (item?.type === 'grade') {
        const internal = gradeKey(item.grade);
        if (!GRADES.includes(internal)) continue;
        texts.push(GRADE_LABELS[internal]);
        expandGrade(resolver, internal, whole, other);
      } else if (item?.type === 'class') {
        const record = byId.get(item.id);
        if (!record) continue;
        texts.push(classFileName(record));
        whole.push(record.id);
      } else if (item?.type === 'union') {
        const union = unions.get(item.id);
        if (!union?.name) continue;
        texts.push(union.name);
        validGrades(union.grades).forEach(grade => expandGrade(resolver, grade, whole, other));
        whole.push(...(union.classIds || []).filter(id => byId.has(id)));
        for (const subset of union.subsets || []) if (subset?.name) subsets.push({name: String(subset.name), classId: byId.has(subset.classId) ? subset.classId : null});
        other.push(...(union.otherStudents || []).map(String).filter(Boolean));
      }
    }
    return {text: texts.join('+'), ...combineStudents(whole, subsets, other)};
  }

  // Οι γραμμές ενός σχεδίου, με τη σειρά του CSV για το FET:
  //   Πρωινή Ζώνη (κατά ημέρα), μετά για κάθε ημέρα Γεύμα και Ολοήμερο (κατά ώρα και θέση), μετά Διευρυμένο.
  // Με αυτή τη σειρά δίνει το FET τα Activity Id στις δραστηριότητες του CSV.
  //   ctx: {staff, classes, teachingHours}. → {rows, sorted, incomplete}: rows με τη σειρά του CSV, sorted κατά
  //   ημέρα και ώρα· incomplete: δραστηριότητες χωρίς εκπαιδευτικό, μάθημα, μαθητές ή ώρα του πίνακα.
  function oloimeroDesignRows(program, ctx = {}) {
    const hours = oloimeroHours(ctx.teachingHours);
    const hourIndex = new Map(hours.map((item, index) => [String(item.hour.id), index]));
    const source = program?.source?.type === 'oloimero-designer' ? program.source : {};
    const placements = isObject(source.placements) ? source.placements : {};
    const staffById = new Map((ctx.staff || []).map(person => [person.id, person]));
    const classes = ctx.classes || [], classById = classesById(classes);
    const zoneTags = ctx.teachingHours?.tags || {}, dayTags = ctx.teachingHours?.dayTags || {};
    const items = [];
    let incomplete = 0;
    (program?.activities || []).forEach((activity, order) => {
      const place = isObject(placements[activity.id]) ? placements[activity.id] : null, time = activity.times?.[0];
      let hour = place ? hours.find(item => String(item.hour.id) === String(place.hourId)) : null;
      if (!hour && time) hour = hours.find(item => item.start === time.start && item.end === time.end);
      const day = Number(place?.day || time?.day) || 0;
      const students = place?.students?.length ? oloimeroStudents(place.students, source, classes).text
        : [...(activity.classes || []).map(id => classFileName(classById.get(id))).filter(Boolean), ...(activity.otherStudents || [])].join('+');
      const teachers = unique([...(activity.staff || []).map(id => staffById.get(id)?.shortName).filter(Boolean), ...(activity.unmatched || [])]);
      const subject = String(activity.subject || '').trim();
      if (!hour || day < 1 || day > 5 || !teachers.length || !subject || !students) { incomplete++; return; }
      const tags = [String(zoneTags[hour.category] || '').trim(), String(dayTags[DAY_KEYS[day - 1]] || '').trim(), hour.fetTag].filter(Boolean);
      items.push({activityId: activity.id, zone: oloimeroZone(hour.category), day, hourId: String(hour.hour.id), hourIndex: hourIndex.get(String(hour.hour.id)), slot: Number.isInteger(place?.slot) ? place.slot : order, order, studentsSets: students, subject, teachers, tags});
    });
    items.sort((a, b) => a.day - b.day || a.hourIndex - b.hourIndex || a.slot - b.slot || a.order - b.order);
    const rows = [...items.filter(item => item.zone === 'morning'), ...[1, 2, 3, 4, 5].flatMap(day => items.filter(item => item.zone === 'day' && item.day === day)), ...items.filter(item => item.zone === 'extended')];
    return {rows, sorted: items, incomplete};
  }

  // Οι γραμμές ενός σχεδίου του .data, με τη σειρά του CSV για το FET και στη μορφή του oloimeroRowsFromCsv
  // ({line, studentsSets, subject, teachers, tags}). line: η θέση της γραμμής στο CSV για το FET (1, 2, …).
  //   ctx: {staff, classes, teachingHours}.
  function oloimeroRowsFromProgram(program, ctx = {}) {
    return oloimeroDesignRows(program, ctx).rows.map((row, index) => ({line: index + 1, activityId: row.activityId, studentsSets: row.studentsSets, subject: row.subject, teachers: [...row.teachers], tags: [...row.tags]}));
  }

  // Εξαγωγή CSV για το FET από ένα σχέδιο περιόδου. Στη στήλη «Teachers» μπαίνει το
  // σύντομο όνομα του Προσωπικού, ή το αρχικό όνομα για όσους δεν αντιστοιχίστηκαν· στη «Students Sets» μια
  // τάξη ως «Β'», ένα τμήμα Γενικής Παιδείας με το κλειδί («Α1», όχι «Α-1»), ένα άλλο τμήμα με το όνομά του και
  // μια Συνένωση με το όνομά της. Το αρχείο κρατά στο τέλος, σε σχόλια που το FET αγνοεί, τα στοιχεία
  // σχεδίασης (μορφή v4: χρώματα, Συνενώσεις, κρυφές Τάξεις και Τμήματα, Σχεδιασμός), με τα τμήματα στη γραφή
  // των αρχείων και όχι με id, ώστε μια νέα εισαγωγή του να δίνει τον ίδιο πίνακα και σε άλλο κοινό αρχείο.
  //   ctx: {staff, classes, teachingHours, now}. → {text, exported, incomplete}.
  function oloimeroCsvFromProgram(program, ctx = {}) {
    const {rows, sorted, incomplete} = oloimeroDesignRows(program, ctx);
    const line = row => [quote(row.studentsSets), quote(row.subject), quote(row.teachers.join('+')), quote(row.tags.join('+')), 1, quote(''), '', '', '', quote('')].join(',');
    const lines = ['﻿' + OLOIMERO_CSV_HEADER, '', '# Πρωινή Ζώνη #'];
    rows.filter(row => row.zone === 'morning').forEach(row => lines.push(line(row)));
    lines.push('', '');
    for (let day = 1; day <= 5; day++) {
      const dayRows = rows.filter(row => row.zone === 'day' && row.day === day);
      if (!dayRows.length) continue;
      lines.push('# Ολοήμερο ' + DAY_LABELS[day - 1] + ' #');
      for (const hourId of unique(dayRows.map(row => row.hourId))) {
        dayRows.filter(row => row.hourId === hourId).forEach(row => lines.push(line(row)));
        lines.push('');
      }
      lines.push('');
    }
    lines.push('# Διευρυμένο #');
    rows.filter(row => row.zone === 'extended').forEach(row => lines.push(line(row)));
    // Ποιοι εκπαιδευτικοί απασχολούνται σε κάθε ζώνη και ποιες ημέρες (ομάδες κατά την πρώτη ημέρα τους).
    const teacherGroups = (zones, separate) => {
      const usage = new Map();
      for (const row of sorted.filter(item => zones.includes(item.zone))) for (const name of row.teachers) {
        if (!usage.has(name)) usage.set(name, {first: row.day, days: new Set()});
        usage.get(name).days.add(row.day);
      }
      let any = false;
      for (let day = 1; day <= 5; day++) {
        const group = [...usage].filter(([, item]) => item.first === day);
        if (!group.length) continue;
        if (any && separate) lines.push('');
        group.forEach(([name, item]) => lines.push('# ' + name + ' [' + [...item.days].sort((a, b) => a - b).map(number => DAY_LABELS[number - 1]).join('-') + ']'));
        any = true;
      }
    };
    lines.push('', '', '# Εκπαιδευτικοί που απασχολούνται στην πρωινή ζώνη #');
    teacherGroups(['morning'], false);
    lines.push('', '', '# Εκπαιδευτικοί που απασχολούνται στο ολοήμερο #', '');
    teacherGroups(['day', 'extended'], true);
    const source = program?.source?.type === 'oloimero-designer' ? program.source : {};
    const staffById = new Map((ctx.staff || []).map(person => [person.id, person]));
    const classById = classesById(ctx.classes || []);
    const fileName = id => classFileName(classById.get(id));
    const metadata = {
      format: 'oloimero-designer-data-v4', exportedAt: ctx.now || nowIso(), name: program?.name || '',
      design: source.design || {hours: []},
      teachers: (source.teachers || []).map(teacher => ({...teacher, name: staffById.get(teacher.staffId)?.shortName || teacher.name})),
      subjects: source.subjects || [],
      unions: (source.unions || []).filter(isObject).map(union => ({
        id: union.id, name: union.name, grades: validGrades(union.grades),
        classes: (union.classIds || []).map(fileName).filter(Boolean),
        subsets: (union.subsets || []).filter(isObject).map(subset => ({name: subset.name, class: fileName(subset.classId)})),
        otherStudents: [...(union.otherStudents || [])]
      })),
      hidden: {grades: validGrades(source.hidden?.grades), classes: (source.hidden?.classes || []).map(fileName).filter(Boolean)},
      styles: source.styles || {}
    };
    lines.push('', '', OLOIMERO_JSON_BEGIN, ...JSON.stringify(metadata, null, 2).split('\n').map(item => '# ' + item), OLOIMERO_JSON_END);
    return {text: lines.join('\n') + '\n', exported: rows.length, incomplete};
  }

  // Τα στοιχεία σχεδίασης που γράφει ο Designer στο τέλος του CSV (σε σχόλια), στη μορφή v4 (με Τάξεις και
  // Τμήματα από τα Τμήματα του έτους, στη γραφή των αρχείων). → κανονικοποιημένα στοιχεία, {invalid:true} όταν
  // δεν διαβάζονται, {old:true} όταν είναι σε παλαιότερη μορφή του Designer (v1–v3, που δεν διαβάζεται πια), ή
  // null όταν το CSV δεν τα έχει. Οι Συνενώσεις: {id, name, grades, classes:[όνομα…], subsets:[{name, class}],
  // otherStudents}.
  function oloimeroMetadata(textValue) {
    const lines = String(textValue ?? '').replace(BOM, '').split(/\r?\n/);
    const begin = lines.findIndex(line => line.trim() === OLOIMERO_JSON_BEGIN);
    const end = begin < 0 ? -1 : lines.findIndex((line, index) => index > begin && line.trim() === OLOIMERO_JSON_END);
    if (begin < 0 || end < 0) return null;
    let payload;
    try { payload = JSON.parse(lines.slice(begin + 1, end).map(line => line.replace(/^\s*# ?/, '')).join('\n')); } catch { return {invalid: true}; }
    if (!isObject(payload)) return {invalid: true};
    const list = value => Array.isArray(value) ? value.filter(isObject) : [];
    const text = value => String(value ?? '').normalize('NFC').trim();
    const texts = value => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
    const format = text(payload.format);
    if (format !== 'oloimero-designer-data-v4') return {old: true};
    const named = value => list(value).map(item => ({id: text(item.id) || uid(), name: text(item.name)})).filter(item => item.name);
    const counts = (value, count) => DAY_LABELS.slice(0, 5).map((_, index) => clampCount(Array.isArray(value) ? value[index] ?? count : count));
    const design = Array.isArray(payload.design?.hours) ? list(payload.design.hours).map(item => ({hourId: text(item.hourId), count: clampCount(item.count), exceptionsEnabled: !!item.exceptionsEnabled, dayCounts: counts(item.dayCounts, item.count)})) : null;
    return {
      format, design,
      styles: Object.fromEntries(OLOIMERO_STYLE_KEYS.map(key => [key, designStyle(payload.styles?.[key])])),
      teachers: list(payload.teachers).map(item => ({
        staffId: text(item.staffId) || null, name: text(item.name),
        color: validColor(item.color) ? String(item.color).toLowerCase() : '', availableHours: Math.max(0, Math.floor(Number(item.availableHours) || 0))
      })).filter(item => item.name || item.staffId),
      subjects: named(payload.subjects),
      unions: list(payload.unions).map(item => ({id: text(item.id) || uid(), name: text(item.name), grades: validGrades(item.grades), classes: texts(item.classes), subsets: list(item.subsets).map(subset => ({name: text(subset.name), class: text(subset.class)})).filter(subset => subset.name), otherStudents: texts(item.otherStudents)})).filter(item => item.name),
      hidden: {grades: validGrades(payload.hidden?.grades), classes: texts(payload.hidden?.classes)}
    };
  }

  // Οι μαθητές των κελιών του Ολοημέρου από ονόματα (στην εισαγωγή CSV).
  //   resolver: SchoolClasses.resolver (ή τα Τμήματα του έτους)· saved: οι Συνενώσεις των στοιχείων σχεδίασης
  //   ({id, name, grades, classes:[όνομα…], subsets:[{name, class}], otherStudents}).
  // → {unions, single(name), cell(name)}:
  //   unions: οι Συνενώσεις με τα τμήματα σε id ({id, name, grades, classIds, subsets:[{name, classId}],
  //     otherStudents}). Μια αποθηκευμένη Συνένωση με όνομα μίας τάξης ή ενός τμήματος δεν μπαίνει, γιατί το
  //     όνομα γίνεται Τάξη ή Τμήμα του κελιού. Η λίστα μεγαλώνει με όσες δημιουργεί το cell.
  //   single(name): μία τάξη («Β'») ή ένα τμήμα → {type:'grade', grade} ή {type:'class', id}· αλλιώς null.
  //   cell(name): τα στοιχεία ενός κελιού: μία τάξη ή ένα τμήμα· μια Συνένωση με το όνομά της· ονόματα με «+»
  //     από τέτοια στοιχεία → περισσότερα στοιχεία· οτιδήποτε άλλο («Α'-Στ'», «Ε1-Γαλ», «Ομάδα Χ») → νέα
  //     Συνένωση με αυτό το όνομα, με τις τάξεις και τα τμήματα που αναγνωρίζονται, και το υπόλοιπο στο otherStudents.
  function oloimeroCells(resolver, saved) {
    const classes = classResolver(resolver);
    const single = value => {
      const name = String(value ?? '');
      if (name.includes('+')) return null;
      const parts = studentsParts(name, classes);
      if (parts.grades.length === 1 && !parts.classIds.length && !parts.subsets.length && !parts.other.length && !/[-–—]/.test(gradeKey(name))) return {type: 'grade', grade: parts.grades[0]};
      if (parts.classIds.length === 1 && !parts.grades.length && !parts.subsets.length && !parts.other.length) return {type: 'class', id: parts.classIds[0]};
      return null;
    };
    const unionFromParts = (base, parts) => ({id: base.id || uid(), name: base.name, grades: parts.grades, classIds: parts.classIds, subsets: parts.subsets, otherStudents: parts.other});
    const unions = [];
    for (const item of (Array.isArray(saved) ? saved : []).filter(isObject)) {
      const name = String(item.name ?? '').normalize('NFC').trim();
      if (!name || single(name)) continue;
      const parts = {grades: validGrades(item.grades), classIds: [], subsets: [], other: [...(item.otherStudents || []).map(String).filter(Boolean)]};
      for (const className of item.classes || []) { const id = classes.resolve(className); if (id) parts.classIds.push(id); else parts.other.push(String(className)); }
      for (const subset of (item.subsets || []).filter(isObject)) parts.subsets.push({name: String(subset.name ?? ''), classId: (subset.class && classes.resolve(subset.class)) || subsetParent(subset.name, classes)});
      parts.classIds = unique(parts.classIds); parts.other = unique(parts.other);
      unions.push(unionFromParts({id: item.id, name}, parts));
    }
    const findUnion = name => unions.find(item => compareKey(item.name) === compareKey(name));
    const cell = value => {
      const name = String(value || '').normalize('NFC').trim();
      if (!name) return [];
      const item = single(name);
      if (item) return [item];
      const union = findUnion(name);
      if (union) return [{type: 'union', id: union.id}];
      const pieces = name.split('+').map(part => part.trim()).filter(Boolean);
      if (pieces.length > 1) {
        const items = pieces.map(part => { const found = findUnion(part); return found ? {type: 'union', id: found.id} : single(part); });
        if (items.every(Boolean)) return items;
      }
      const created = unionFromParts({name}, studentsParts(name, classes));
      unions.push(created);
      return [{type: 'union', id: created.id}];
    };
    return {unions, single, cell};
  }

  // Ανάλυση της εισαγωγής ενός CSV του Ολοήμερου Designer (πρώτη φάση· δεν αλλάζει τίποτα).
  //   input: {csvText, csvName, staff, classes, classLimit, teachingHours}. classes: τα Τμήματα του έτους, μαζί
  //   με όσα δεν έχουν αποθηκευτεί ακόμη· classLimit: το όριο πλήθους τμημάτων.
  //   Οι ημέρες και οι ώρες βγαίνουν από τις ετικέτες ημέρας (dayTags) και ώρας (fetTag) των Ωρών
  //   Διδασκαλίας. Αν το CSV έχει τα στοιχεία σχεδίασης του Designer, κρατιούνται χρώματα, Συνενώσεις,
  //   κρυφές Τάξεις και Τμήματα και Σχεδιασμός.
  //   Μαθητές κάθε γραμμής («Students Sets»): μια τάξη («Β'») ή ένα τμήμα γίνεται Τάξη ή Τμήμα του κελιού (τα
  //   τμήματα αντιστοιχίζονται με το SchoolClasses.resolver, και όσα Γενικής Παιδείας λείπουν δημιουργούνται)·
  //   μια Συνένωση των στοιχείων σχεδίασης με το όνομά της· ονόματα με «+» από τέτοια στοιχεία γίνονται
  //   περισσότερα στοιχεία του κελιού· οτιδήποτε άλλο (π.χ. «Α'-Στ'») γίνεται Συνένωση με αυτό το όνομα.
  //   Ο Designer δέχεται μόνο τάξεις και τμήματα Γενικής Παιδείας: υποσύνολα («Ε1-Γαλ»), άλλα τμήματα
  //   («Τμήμα Ένταξης») και ομάδες μαθητών («Ομάδα Χ»), στις γραμμές ή στις Συνενώσεις των στοιχείων
  //   σχεδίασης, σταματούν την εισαγωγή με λάθος.
  // → {ok, errors, warnings, info, unmatchedTeachers, counts, newClasses, …}. Με λάθη η εισαγωγή δεν γίνεται.
  function analyzeOloimeroImport(input = {}) {
    const result = {ok: false, errors: [], warnings: [], info: [], unmatchedTeachers: [], counts: {}, newClasses: [], csvName: input.csvName || ''};
    const stop = message => { result.errors.push(message); return result; };
    const staff = input.staff || [];
    if (!staff.length) return stop('Δεν έχει συμπληρωθεί το Προσωπικό του σχολικού έτους. Συμπλήρωσέ το πρώτα στο «Προσωπικό».');
    let hours;
    try { hours = oloimeroHours(input.teachingHours); } catch (error) { return stop(error.message); }
    const sets = tagSets(input.teachingHours);
    if (!sets.dayTags.size || !hours.some(item => item.fetTag)) return stop('Οι Ώρες Διδασκαλίας δεν έχουν ετικέτες FET ημερών ή ωρών Ολοημέρου. Συμπλήρωσέ τες πρώτα στις «Ώρες Διδασκαλίας».');
    // Συμβατότητα με CSV που δημιουργήθηκαν πριν αποκτήσουν αγκύλες οι ετικέτες ωρών.
    const hourTagKey = tag => String(tag || '').trim().replace(/^\[(ΩΡΑ_[^\]]+)\]$/, '$1');
    const hourByTag = new Map(hours.filter(item => item.fetTag).map(item => [hourTagKey(item.fetTag), item]));
    let rows;
    try { rows = oloimeroRowsFromCsv(input.csvText); } catch (error) { return stop(error.message); }
    if (!rows.length) return stop('Το CSV του Ολοήμερου δεν έχει δραστηριότητες.');

    // Ημέρα και ώρα από τις ετικέτες· θέση στον πίνακα με τη σειρά των γραμμών.
    const placed = [], skipped = [], slots = new Map();
    for (const row of rows) {
      const day = sets.dayTags.get(row.tags.find(tag => sets.dayTags.has(tag))), hour = hourByTag.get(hourTagKey(row.tags.find(tag => hourByTag.has(hourTagKey(tag)))));
      if (!day || !hour) { skipped.push(row); continue; }
      const key = hour.hour.id + '|' + day, slot = slots.get(key) || 0;
      slots.set(key, slot + 1);
      placed.push({row, day, hour, slot});
    }
    if (!placed.length) return stop('Καμία γραμμή του CSV δεν έχει ετικέτα ημέρας και ετικέτα ώρας Ολοημέρου των Ωρών Διδασκαλίας. Έλεγξε ότι το CSV βγήκε με τις τρέχουσες ετικέτες των Ωρών Διδασκαλίας.');
    if (skipped.length) result.warnings.push(skipped.length + ' γραμμές του CSV δεν έχουν ετικέτα ημέρας ή ώρας Ολοημέρου των Ωρών Διδασκαλίας και δεν εισάγονται (γραμμές ' + skipped.slice(0, 8).map(row => row.line).join(', ') + (skipped.length > 8 ? ', …' : '') + ').');

    const metadata = oloimeroMetadata(input.csvText);
    if (metadata?.invalid) result.info.push('Τα στοιχεία σχεδίασης στο τέλος του CSV δεν διαβάζονται. Εισάγονται μόνο οι δραστηριότητες, με προεπιλεγμένα χρώματα.');
    if (metadata?.old) result.info.push('Τα στοιχεία σχεδίασης στο τέλος του CSV είναι σε παλαιότερη μορφή του Ολοήμερου Designer, που δεν διαβάζεται πια. Εισάγονται μόνο οι δραστηριότητες, με προεπιλεγμένα χρώματα.');
    const meta = metadata && !metadata.invalid && !metadata.old ? metadata : null;
    if (meta) result.info.push('Κρατήθηκαν και τα στοιχεία σχεδίασης του Designer που υπάρχουν στο CSV (χρώματα, συνενώσεις, Σχεδιασμός).');

    // Εκπαιδευτικοί: με το σύντομο όνομα, μετά με τον κωδικό.
    const byShortName = new Map(staff.filter(person => person.shortName).map(person => [compareKey(person.shortName), person]));
    const byCode = new Map(staff.filter(person => person.code).map(person => [compareKey(person.code), person]));
    const teacherNames = unique(placed.flatMap(item => item.row.teachers));
    const teacherMatch = new Map(teacherNames.map(name => [name, byShortName.get(compareKey(name)) || byCode.get(compareKey(name)) || null]));
    result.unmatchedTeachers = teacherNames.filter(name => !teacherMatch.get(name));
    if (result.unmatchedTeachers.length) result.warnings.push('Εκπαιδευτικοί χωρίς αντιστοίχιση στο Προσωπικό: ' + result.unmatchedTeachers.map(quoted).join(', ') + '. Μπορούν να εισαχθούν χωρίς αντιστοίχιση ή να μην εισαχθούν. Για αντιστοίχιση, διόρθωσε το σύντομο όνομα στο Προσωπικό ή στο CSV.');

    // Μαθητές: Τάξεις, Τμήματα και Συνενώσεις.
    const resolver = classResolver(input.classes, {limit: input.classLimit});
    const {unions, cell} = oloimeroCells(resolver, meta?.unions);
    for (const item of placed) item.students = cell(item.row.studentsSets);
    // Μόνο τάξεις και τμήματα Γενικής Παιδείας, στα κελιά και στις Συνενώσεις (και όσες δεν χρησιμοποιούνται,
    // γιατί αποθηκεύονται κι αυτές).
    const classById = classesById(resolver.classes), unionById = new Map(unions.map(union => [union.id, union]));
    const notAccepted = union => [
      ...(union?.classIds || []).filter(id => !isGeneralClass(classById.get(id))).map(id => classNameOf(classById, id)),
      ...(union?.subsets || []).map(subset => subset.name), ...(union?.otherStudents || [])
    ];
    const rejected = [];
    for (const item of placed) for (const part of item.students) {
      if (part.type === 'class' && !isGeneralClass(classById.get(part.id))) rejected.push(classNameOf(classById, part.id));
      else if (part.type === 'union') rejected.push(...notAccepted(unionById.get(part.id)));
    }
    unions.forEach(union => rejected.push(...notAccepted(union)));
    const rejectedNames = unique(rejected.map(String).filter(Boolean));
    if (rejectedNames.length) return stop((rejectedNames.length === 1 ? 'Στο αρχείο CSV υπάρχει το Τμήμα ' + quoted(rejectedNames[0]) + ' που δεν γίνεται αποδεκτό.' : 'Στο αρχείο CSV υπάρχουν τα Τμήματα ' + rejectedNames.map(quoted).join(', ') + ' που δεν γίνονται αποδεκτά.') + " Ο Ολοήμερος Designer δέχεται μόνο τάξεις (π.χ. «Β'», «Α'-Στ'») και τμήματα Γενικής Παιδείας (π.χ. «Α1»). Παρακαλώ διορθώστε το CSV και ξαναδοκιμάστε.");
    if (resolver.overLimit.length) return stop('Η εισαγωγή θα δημιουργούσε τα τμήματα ' + resolver.overLimit.join(', ') + ', πάνω από το όριο των ' + input.classLimit + ' τμημάτων του σχολικού έτους. Αφαίρεσε τμήματα που δεν χρειάζονται στα «Τμήματα» ή διόρθωσε το CSV.');
    for (const item of placed) item.expanded = oloimeroStudents(item.students, {unions}, resolver);
    const labels = new Set(Object.values(GRADE_LABELS));
    const emptyGrades = unique(placed.flatMap(item => item.expanded.otherStudents.filter(name => labels.has(name))));
    if (emptyGrades.length) result.warnings.push((emptyGrades.length === 1 ? 'Η τάξη ' + emptyGrades[0] + ' δεν έχει' : 'Οι τάξεις ' + emptyGrades.join(', ') + ' δεν έχουν') + ' τμήματα στα «Τμήματα». Οι δραστηριότητές τους μπαίνουν χωρίς τμήμα· πρόσθεσε τα τμήματα στα «Τμήματα» και ξαναδοκίμασε.');
    result.newClasses = clone(sortClasses(resolver.newClasses));
    if (result.newClasses.length) result.warnings.push('Θα δημιουργηθούν τα τμήματα: ' + result.newClasses.map(item => item.name).join(', ') + '.');

    // Σχεδιασμός: από τα στοιχεία του Designer, αλλιώς από τις γραμμές· πάντα αρκετά κελιά για τις γραμμές.
    const needed = new Map();
    for (const item of placed) {
      if (!needed.has(item.hour.hour.id)) needed.set(item.hour.hour.id, [0, 0, 0, 0, 0]);
      const list = needed.get(item.hour.hour.id);
      list[item.day - 1] = Math.max(list[item.day - 1], item.slot + 1);
    }
    let raised = false;
    const design = {hours: hours.map(item => {
      const id = String(item.hour.id), need = needed.get(item.hour.id) || [0, 0, 0, 0, 0];
      const saved = meta?.design?.find(entry => entry.hourId === id);
      if (!saved) {
        const count = Math.max(...need);
        return {hourId: id, count, exceptionsEnabled: need.some(value => value !== count), dayCounts: need.map(value => need.some(other => other !== count) ? value : count)};
      }
      const entry = {hourId: id, count: saved.count, exceptionsEnabled: saved.exceptionsEnabled, dayCounts: [...saved.dayCounts]};
      need.forEach((value, index) => {
        const current = entry.exceptionsEnabled ? entry.dayCounts[index] : entry.count;
        if (value <= current) return;
        raised = true;
        if (entry.exceptionsEnabled) entry.dayCounts[index] = value;
        else { entry.count = value; entry.dayCounts = entry.dayCounts.map(() => value); }
      });
      return entry;
    })};
    if (raised) result.info.push('Ο Σχεδιασμός του CSV είχε λιγότερα κελιά από τις δραστηριότητες σε κάποιες ώρες· αυξήθηκαν ώστε να χωρούν όλες.');
    // Κρυφές Τάξεις και Τμήματα (μόνο όσα υπάρχουν).
    const hidden = {grades: meta?.hidden?.grades || [], classes: unique((meta?.hidden?.classes || []).map(name => resolver.find(name)).filter(Boolean))};

    result.counts = {activities: placed.length, rows: rows.length, teachers: teacherNames.length, matched: teacherNames.length - result.unmatchedTeachers.length, classes: unique(placed.flatMap(item => item.expanded.classes)).length};
    result.ok = true;
    // Για τη δεύτερη φάση (buildOloimeroProgram). Δεν προορίζονται για εμφάνιση.
    Object.defineProperty(result, 'plan', {enumerable: false, value: {placed, teacherMatch, meta, unions, hidden, design, staff}});
    return result;
  }

  // Κατασκευή του σχεδίου από την ανάλυση (δεύτερη φάση). Τα νέα τμήματα της ανάλυσης (analysis.newClasses)
  // τα αποθηκεύει η εφαρμογή μαζί με το σχέδιο.
  //   options: {unmatched:'keep'|'drop', kind ('oloimero'), name, periodId, id, now}.
  function buildOloimeroProgram(analysis, options = {}) {
    if (!analysis?.ok || !analysis.plan) throw Error('Η εισαγωγή δεν μπορεί να γίνει: ' + (analysis?.errors?.[0] || 'δεν έγινε ανάλυση.'));
    const {placed, teacherMatch, meta, unions, hidden, design, staff} = analysis.plan;
    const keepUnmatched = options.unmatched !== 'drop', at = options.now || nowIso();
    const activities = [], placements = {};
    // Μόνο οι Συνενώσεις των στοιχείων σχεδίασης και όσες χρησιμοποιούνται.
    const savedIds = new Set((meta?.unions || []).map(item => item.id));
    const used = new Set(placed.flatMap(item => item.students.filter(part => part.type === 'union').map(part => part.id)));
    for (const item of placed) {
      const id = uid();
      const people = item.row.teachers.map(name => teacherMatch.get(name)).filter(Boolean);
      activities.push({
        id, subject: item.row.subject, staff: unique(people.map(person => person.id)),
        unmatched: keepUnmatched ? unique(item.row.teachers.filter(name => !teacherMatch.get(name))) : [],
        classes: [...item.expanded.classes], subsets: [...item.expanded.subsets], otherStudents: [...item.expanded.otherStudents], room: '',
        times: [{day: item.day, start: item.hour.start, end: item.hour.end}]
      });
      placements[id] = {hourId: String(item.hour.hour.id), day: item.day, slot: item.slot, students: clone(item.students)};
    }
    // Εκπαιδευτικοί της αριστερής μπάρας: όσοι είχε επιλέξει ο Designer και όσοι εμφανίζονται στις γραμμές.
    const savedFor = person => meta?.teachers.find(item => item.staffId === person.id)
      || meta?.teachers.find(item => compareKey(item.name) === compareKey(person.shortName));
    const chosen = new Map();
    for (const saved of meta?.teachers || []) {
      const person = staff.find(item => item.id === saved.staffId) || staff.find(item => compareKey(item.shortName) === compareKey(saved.name));
      if (person) chosen.set(person.id, person);
    }
    for (const person of teacherMatch.values()) if (person) chosen.set(person.id, person);
    const teachers = sortStaff([...chosen.values()]).map(person => {
      const saved = savedFor(person);
      return {staffId: person.id, name: person.shortName, color: saved?.color || oloimeroTeacherColor(person), availableHours: saved?.availableHours || 0};
    });
    if (keepUnmatched) {
      for (const name of [...teacherMatch].filter(([, person]) => !person).map(([name]) => name).sort((a, b) => a.localeCompare(b, 'el', {numeric: true, sensitivity: 'base'}))) {
        const saved = meta?.teachers.find(item => !item.staffId && compareKey(item.name) === compareKey(name));
        teachers.push({staffId: null, name, color: saved?.color || OLOIMERO_COLORS.other, availableHours: saved?.availableHours || 0});
      }
    }
    const subjects = clone(meta?.subjects || []);
    for (const name of unique(placed.map(item => item.row.subject).filter(Boolean))) if (!subjects.some(item => compareKey(item.name) === compareKey(name))) subjects.push({id: uid(), name});
    return {
      id: options.id || uid(), formatVersion: 2, kind: options.kind || 'oloimero', periodId: options.periodId ?? null,
      name: options.name || '', createdAt: at, updatedAt: at, activities,
      // A new import starts its history with the import (see SchoolTimetable.history).
      history: [{at, type: 'import', importer: 'csv', files: [analysis.csvName].filter(Boolean), activities: activities.length}],
      source: {
        type: 'oloimero-designer', version: 2, csvName: analysis.csvName, importedAt: at,
        design: clone(design), teachers, subjects,
        unions: clone(unions.filter(union => savedIds.has(union.id) || used.has(union.id))),
        hidden: clone(hidden),
        styles: clone(meta?.styles || Object.fromEntries(OLOIMERO_STYLE_KEYS.map(key => [key, designStyle(null)]))),
        placements, pending: []
      }
    };
  }

  // Ο εισαγωγέας του Ολοημέρου: το CSV που εξάγει ο Ολοήμερο Designer για το FET, με τα στοιχεία σχεδίασης
  // στη μορφή v4. Ημέρες και ώρες από τις ετικέτες των Ωρών Διδασκαλίας.
  function oloimeroImporter() {
    return Object.freeze({
      id: 'csv',
      label: 'Εισαγωγή από CSV Ολοημέρου',
      intro: 'Επίλεξε το CSV που εξάγει ο Ολοήμερο Designer για το FET.',
      files: Object.freeze([
        Object.freeze({key: 'csv', label: 'CSV Ολοημέρου', description: 'CSV του Ολοήμερου Designer', accept: Object.freeze({'text/csv': ['.csv']})})
      ]),
      analyze(files, options = {}) {
        const analysis = analyzeOloimeroImport({csvText: files.csv?.text, csvName: files.csv?.name, staff: options.staff, classes: options.classes, classLimit: options.classLimit, teachingHours: options.teachingHours});
        if (analysis.ok) {
          analysis.summary = [
            {value: analysis.counts.activities, label: 'δραστηριότητες'},
            {value: analysis.counts.classes, label: 'τμήματα'},
            {value: analysis.counts.matched + '/' + analysis.counts.teachers, label: 'εκπαιδευτικοί με αντιστοίχιση'}
          ];
          if (analysis.newClasses.length) analysis.summary.push({value: analysis.newClasses.length, label: 'νέα τμήματα'});
        }
        return analysis;
      },
      build: (analysis, options = {}) => buildOloimeroProgram(analysis, options)
    });
  }

  // =============================================================================================
  // ---- Σχέδιο Ολοημέρου στην εισαγωγή FET ----
  // =============================================================================================
  // Τα σχέδια των περιόδων συγκρίνονται με ένα Ωρολόγιο στις ζώνες Ολοημέρου, ώρα προς ώρα, με
  // τον κανόνα της σύνθεσης (SchoolTimetable.oloimeroDiff).
  //   school: το Ωρολόγιο· designs: τα σχέδια· options: {classes, teachingHours}.
  // → [{program, fetOnly, designOnly, differences, same}], με τη σειρά των διαφορών (λιγότερες πρώτα· ίσες με τη
  //   σειρά του designs). differences: οι ώρες που διαφέρουν (fetOnly + designOnly)· same: χωρίς διαφορές.
  function oloimeroDesignMatches(school, designs, options = {}) {
    return (Array.isArray(designs) ? designs : []).filter(isObject).map((program, order) => {
      const {fetOnly, designOnly} = parts.oloimeroDiff(school, program, options);
      const differences = fetOnly.length + designOnly.length;
      return {program, fetOnly, designOnly, differences, same: differences === 0, order};
    }).sort((a, b) => a.differences - b.differences || a.order - b.order).map(({order, ...item}) => item);
  }

  // Αυτόματη δημιουργία σχεδίου Ολοημέρου από ένα Ωρολόγιο: οι δραστηριότητές του στις ζώνες Ολοημέρου, ώρα προς
  // ώρα, γίνονται θέσεις του πίνακα του Designer.
  //   - Κάθε ώρα μιας δραστηριότητας σε ζώνη Ολοημέρου γίνεται μία δραστηριότητα του σχεδίου, σε μία θέση της ώρας
  //     και της ημέρας της. Οι ώρες στο Πρωινό αγνοούνται.
  //   - Μαθητές του κελιού: τα τμήματα Γενικής Παιδείας της δραστηριότητας· όταν είναι όλα τα τμήματα μιας τάξης,
  //     γίνονται η τάξη (Α1 + Α2 → Α'). Υποσύνολα, άλλα τμήματα και ομάδες μαθητών δεν μπαίνουν (η εισαγωγή FET
  //     τα απορρίπτει στις ζώνες Ολοημέρου).
  //   - Σειρά θέσεων σε κάθε ώρα και ημέρα: με το μικρότερο τμήμα του κελιού (πρώτα η Α', μετά η Β'· Α1, Α2, Β1).
  //   - Χρώματα: δάσκαλοι κίτρινο, οι υπόλοιποι γαλάζιο (oloimeroTeacherColor).
  //   - Δραστηριότητα χωρίς εκπαιδευτικό, μάθημα ή μαθητές → ελλιπές κελί (source.pending).
  //   - Σχεδιασμός: σε κάθε ώρα όσες θέσεις χρειάζονται, με εξαιρέσεις ανά ημέρα όταν διαφέρουν.
  //   school: το Ωρολόγιο· options: {staff, classes, teachingHours, periodId, name, id, now,
  //   availableHours(staffId) → ώρες (οι διαθέσιμες ώρες των εκπαιδευτικών στο σχέδιο· χωρίς αυτό 0)}.
  // → το σχέδιο (kind 'oloimero'). Πετά λάθος όταν μια ώρα χρειάζεται περισσότερες από OLOIMERO_MAX_SLOTS θέσεις.
  function oloimeroDesignFromSchool(school, options = {}) {
    const hours = oloimeroHours(options.teachingHours), at = options.now || nowIso();
    const classes = (options.classes || []).filter(isObject), byId = classesById(classes);
    const grades = classGrades(classes);
    const staffById = new Map((options.staff || []).map(person => [person.id, person]));
    // The students of a cell from the classes of the activity: whole τάξεις, then the τμήματα left.
    const studentsOf = ids => {
      const own = new Set((ids || []).filter(id => isGeneralClass(byId.get(id))));
      const items = [];
      for (const grade of grades) {
        const inGrade = grade.classes.filter(record => own.has(record.id));
        if (!inGrade.length) continue;
        if (inGrade.length === grade.classes.length) items.push({type: 'grade', grade: grade.grade});
        else items.push(...inGrade.map(record => ({type: 'class', id: record.id})));
      }
      return items;
    };
    // The smallest τμήμα of a cell, for the order of the places: [index of the τάξη, number].
    const smallest = ids => {
      const records = (ids || []).map(id => byId.get(id)).filter(isGeneralClass);
      if (!records.length) return [GRADES.length, Infinity];
      const first = sortClasses(records)[0];
      return [GRADES.indexOf(gradeKey(first.grade)), Number(first.number) || 0];
    };
    const cells = [];
    for (const activity of Array.isArray(school?.activities) ? school.activities : []) {
      if (!isObject(activity)) continue;
      for (const time of Array.isArray(activity.times) ? activity.times : []) {
        const hour = hours.find(item => item.start <= time?.start && time?.end <= item.end);
        const day = Number(time?.day) || 0;
        if (!hour || day < 1 || day > 5) continue;
        cells.push({activity, hour, day, students: studentsOf(activity.classes), rank: smallest(activity.classes), order: cells.length});
      }
    }
    // Places: in every hour and day by the smallest τμήμα.
    const groups = new Map();
    for (const cell of cells) {
      const key = cell.hour.hour.id + '|' + cell.day;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(cell);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.order - b.order);
      if (list.length > OLOIMERO_MAX_SLOTS) throw Error('Η ώρα ' + list[0].hour.name + ' της ' + DAY_LABELS[list[0].day - 1] + ' έχει ' + list.length + ' δραστηριότητες στο Ωρολόγιο, περισσότερες από τις ' + OLOIMERO_MAX_SLOTS + ' θέσεις του πίνακα του Ολοήμερου Designer.');
      list.forEach((cell, slot) => { cell.slot = slot; });
    }
    const subjects = [], subjectId = name => {
      let subject = subjects.find(item => compareKey(item.name) === compareKey(name));
      if (!subject) subjects.push(subject = {id: uid(), name});
      return subject.id;
    };
    const activities = [], placements = {}, pending = [];
    for (const cell of [...cells].sort((a, b) => a.day - b.day || a.hour.start.localeCompare(b.hour.start) || a.slot - b.slot)) {
      const source = cell.activity, subject = String(source.subject || '').trim();
      const staff = unique((source.staff || []).filter(id => staffById.has(id))), unmatched = unique((source.unmatched || []).map(String).filter(Boolean));
      const hourId = String(cell.hour.hour.id);
      if (!subject || (!staff.length && !unmatched.length) || !cell.students.length) {
        pending.push({hourId, day: cell.day, slot: cell.slot, staffId: staff[0] || null, name: staff.length ? null : unmatched[0] || null, subjectId: subject ? subjectId(subject) : null, students: clone(cell.students)});
        continue;
      }
      subjectId(subject);
      const id = uid(), expanded = oloimeroStudents(cell.students, {unions: []}, classes);
      activities.push({id, subject, staff, unmatched, classes: [...expanded.classes], subsets: [...expanded.subsets], otherStudents: [...expanded.otherStudents], room: '', times: [{day: cell.day, start: cell.hour.start, end: cell.hour.end}]});
      placements[id] = {hourId, day: cell.day, slot: cell.slot, students: clone(cell.students)};
    }
    const design = {hours: hours.map(item => {
      const need = [1, 2, 3, 4, 5].map(day => groups.get(item.hour.id + '|' + day)?.length || 0);
      const count = Math.max(...need), exceptionsEnabled = need.some(value => value !== count);
      return {hourId: String(item.hour.id), count, exceptionsEnabled, dayCounts: exceptionsEnabled ? need : need.map(() => count)};
    })};
    // Teachers of the sidebar: those of the activities and of the incomplete cells, in the order of Προσωπικό.
    const available = id => { const value = Number(options.availableHours?.(id)); return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0; };
    const people = unique([...activities.flatMap(item => item.staff), ...pending.map(item => item.staffId).filter(Boolean)]).map(id => staffById.get(id));
    const teachers = sortStaff(people).map(person => ({staffId: person.id, name: person.shortName, color: oloimeroTeacherColor(person), availableHours: available(person.id)}));
    const names = unique([...activities.flatMap(item => item.unmatched), ...pending.map(item => item.name).filter(Boolean)]).sort((a, b) => a.localeCompare(b, 'el', {numeric: true, sensitivity: 'base'}));
    for (const name of names) teachers.push({staffId: null, name, color: OLOIMERO_COLORS.other, availableHours: 0});
    return {
      id: options.id || uid(), formatVersion: 2, kind: 'oloimero', periodId: options.periodId ?? null,
      name: options.name || '', createdAt: at, updatedAt: at, activities,
      history: [{at, type: 'create', from: 'school'}],
      source: {
        type: 'oloimero-designer', version: 2,
        design, teachers, subjects, unions: [], hidden: {grades: [], classes: []},
        styles: Object.fromEntries(OLOIMERO_STYLE_KEYS.map(key => [key, designStyle(null)])),
        placements, pending
      }
    };
  }

  // ---- Ιστορικό: η εγγραφή μιας αποθήκευσης του Designer ----
  // The history entry of one save of a σχέδιο, as in the Ατομικά Προγράμματα: before is the σχέδιο as stored (or, for
  // a σχέδιο not stored yet, as it came from an import or a copy; null for a new empty one), after the one saved.
  //   → {type:'edit', staff:[name…]} when the cells of teachers changed: their activities or incomplete cells (day,
  //     hour, place, subject, students). Names as they are now: of the Προσωπικό (full name, or short name), in its
  //     order, then the names without a match, alphabetically.
  //   → {type:'edit'} when only something else of the σχέδιο changed (e.g. formatting, colours, subjects, Συνενώσεις,
  //     the places of an hour, the classes shown, an incomplete cell without a teacher), and there is a before.
  //   → null when nothing changed.
  // The ids of the activities and the classes of the cells (computed from the students) do not count.
  function oloimeroHistoryEdit(before, after, options = {}) {
    const staffById = new Map((options.staff || []).filter(isObject).map(person => [person.id, person]));
    const signatures = program => {
      const map = new Map(), source = isObject(program?.source) ? program.source : {};
      const subjects = new Map((Array.isArray(source.subjects) ? source.subjects : []).filter(isObject).map(item => [compareKey(item.name), item.id]));
      const placements = isObject(source.placements) ? source.placements : {};
      const add = (key, row) => { if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
      for (const activity of Array.isArray(program?.activities) ? program.activities.filter(isObject) : []) {
        const place = isObject(placements[activity.id]) ? placements[activity.id] : {};
        const subject = subjects.get(compareKey(activity.subject)) ?? 'n:' + compareKey(activity.subject);
        const row = JSON.stringify(['a', place.hourId ?? '', place.day ?? '', place.slot ?? '', place.students ?? [], subject, activity.times || []]);
        for (const id of activity.staff || []) add('id:' + id, row);
        for (const name of activity.unmatched || []) add('name:' + compareKey(name), row);
      }
      for (const cell of (Array.isArray(source.pending) ? source.pending : []).filter(isObject)) {
        const row = JSON.stringify(['p', cell.hourId ?? '', cell.day ?? '', cell.slot ?? '', cell.students ?? [], cell.subjectId ?? '']);
        if (cell.staffId) add('id:' + cell.staffId, row); else if (cell.name) add('name:' + compareKey(cell.name), row);
      }
      for (const rows of map.values()) rows.sort();
      return map;
    };
    const was = signatures(before), now = signatures(after);
    const changed = unique([...was.keys(), ...now.keys()]).filter(key => JSON.stringify(was.get(key) || []) !== JSON.stringify(now.get(key) || []));
    if (changed.length) {
      // The name of a teacher: of the Προσωπικό, else as the σχέδιο has it (a deleted teacher, or a name without a match).
      const teacherName = (program, key) => (program?.source?.teachers || []).filter(isObject)
        .find(item => key.startsWith('id:') ? item.staffId === key.slice(3) : !item.staffId && compareKey(item.name) === key.slice(5))?.name;
      const people = sortStaff(changed.filter(key => key.startsWith('id:') && staffById.has(key.slice(3))).map(key => staffById.get(key.slice(3))));
      const others = changed.filter(key => !(key.startsWith('id:') && staffById.has(key.slice(3))))
        .map(key => teacherName(after, key) || teacherName(before, key) || (key.startsWith('name:') ? key.slice(5) : '?'))
        .sort((a, b) => a.localeCompare(b, 'el', {numeric: true, sensitivity: 'base'}));
      return {type: 'edit', staff: [...people.map(person => String(person.name || person.shortName || '')), ...others]};
    }
    if (!isObject(before)) return null;
    // The rest of the σχέδιο, with the incomplete cells without a teacher (they belong to no one).
    const rest = program => {
      const {placements, pending, csvName, importedAt, ...source} = isObject(program?.source) ? program.source : {};
      const orphans = (Array.isArray(pending) ? pending : []).filter(cell => isObject(cell) && !cell.staffId && !cell.name)
        .map(cell => JSON.stringify([cell.hourId ?? '', cell.day ?? '', cell.slot ?? '', cell.students ?? [], cell.subjectId ?? ''])).sort();
      return JSON.stringify({name: program?.name || '', source, orphans});
    };
    return rest(before) !== rest(after) ? {type: 'edit'} : null;
  }

  Object.assign(parts, {OLOIMERO_MAX_SLOTS, oloimeroStudents});

  const timetable = window.SchoolTimetable;
  timetable.kinds.oloimero.importers.push(oloimeroImporter());
  Object.freeze(timetable.kinds.oloimero.importers);
  Object.freeze(Object.assign(timetable, {
    OLOIMERO_MAX_SLOTS, oloimeroHours, oloimeroTeacherColor, oloimeroStudents,
    oloimeroRowsFromCsv, oloimeroRowsFromProgram, oloimeroCsvFromProgram, oloimeroCells, analyzeOloimeroImport, buildOloimeroProgram,
    oloimeroDesignMatches, oloimeroDesignFromSchool, oloimeroHistoryEdit
  }));
  parts.loaded('_data_oloimero.js');
})();
