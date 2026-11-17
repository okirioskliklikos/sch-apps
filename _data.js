/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων: κείμενο, ημερομηνίες, τμήματα, μαθητές, ετικέτες
 * Έκδοση αρχείου: 0.44
 * Όνομα κατά την εγκατάσταση: _data.js
 *
 * Ο κοινός κώδικας δεδομένων είναι σε τέσσερα αρχεία, που φορτώνονται πάντα όλα, με αυτή τη σειρά, μετά το _ui.js
 * και πριν από το δικό τους script (στο index πριν από τα _host_*.js):
 *   <script src="_data.js"></script>
 *   <script src="_data_timetable.js"></script>
 *   <script src="_data_oloimero.js"></script>
 *   <script src="_data_documents.js"></script>
 * Δεν έχουν δικό τους περιβάλλον χρήστη: δεν ανοίγουν διαλόγους και δεν γράφουν στη σελίδα. Κάθε αρχείο ελέγχει ότι
 * φορτώθηκαν πριν από αυτό τα προηγούμενα, και αλλιώς σταματά με μήνυμα που λέει ποιο λείπει.
 * Τα τέσσερα αρχεία:
 *   _data.js            (αυτό) κείμενο, ημερομηνίες, HTML, τμήματα, μαθητές, ετικέτες, και οι εσωτερικοί βοηθοί
 *                       που χρειάζονται τα υπόλοιπα (window.SchoolDataParts)
 *   _data_timetable.js  CSV, FET και προγράμματα (window.SchoolCsv, window.SchoolFet, window.SchoolTimetable)
 *   _data_oloimero.js   σχέδια του Ολοήμερου Designer, CSV Ολοημέρου, Εισαγωγή Ολοημέρου στο ωρολόγιο· προσθέτει
 *                       τα μέλη του στο window.SchoolTimetable και το παγώνει
 *   _data_documents.js  πεδία εγγράφων του Documents Templater (window.SchoolDocumentFields)
 * Αυτό το αρχείο ορίζει:
 *   window.SchoolText       κανονικοποίηση ελληνικού κειμένου, ονόματα ημερών
 *   window.SchoolDate       ημερομηνίες: dd/mm/yyyy για τον χρήστη, 'YYYY-MM-DD' για την αποθήκευση
 *   window.SchoolClasses    τμήματα (classesByYear): είδος, κλειδί («Α1»), ταξινόμηση, τάξεις, μετονομασία,
 *                           αντιστοίχιση ονομάτων των αρχείων σε τμήματα (με αυτόματη δημιουργία τμημάτων
 *                           Γενικής Παιδείας)
 *   window.SchoolHtml       κείμενο με μορφοποίηση (HTML του schoolRichText): καθαρισμός, έλεγχος κενού
 *   window.SchoolStudents   μαθητές (studentsByYear): ανάγνωση του CSV μαθητών του myschool, ίδιος μαθητής,
 *                           τάξη και επόμενο τμήμα, κατάσταση ΑΔΥΜ, ταξινόμηση
 *   window.SchoolTags       ετικέτες (tagsByYear): κατηγορίες, χρώματα κατηγορίας, όνομα και χρώμα κάθε ετικέτας,
 *                           κοινή σειρά, σύγκριση ονομάτων γενικών ετικετών
 *   window.SchoolDataParts  εσωτερικό, μόνο για τα _data*.js: οι βοηθοί που μοιράζονται (ανάγνωση CSV, κλειδί
 *                           σύγκρισης, ημερομηνίες, τμήματα, δάσκαλοι και σειρά του Προσωπικού κ.ά.), όσα προσθέτει
 *                           κάθε επόμενο αρχείο για τα επόμενα, και ο έλεγχος της σειράς φόρτωσης (needs, loaded).
 *                           Οι εφαρμογές δεν το χρησιμοποιούν.
 * Η ανάγνωση CSV (parse, quote, detectDelimiter) είναι εδώ, γιατί τη χρειάζεται και το CSV μαθητών· το
 * window.SchoolCsv το ορίζει το _data_timetable.js. Οι δάσκαλοι και η σειρά του Προσωπικού (isGeneralTeacher,
 * sortStaff, sortStaffAlphabetically) είναι εδώ, γιατί τα χρειάζονται και οι ετικέτες· στις εφαρμογές τα δίνει το
 * window.SchoolTimetable.
 */
(() => {
  'use strict';
  const BOM = /^\uFEFF/;

  // Διαχωριστικό στηλών από την πρώτη γραμμή: «;» όταν μετρά περισσότερα από τα «,» έξω από
  // εισαγωγικά (έτσι αποθηκεύει το Excel στα ελληνικά Windows), αλλιώς «,».
  function detectDelimiter(text) {
    const firstLine = String(text ?? '').split(/\r?\n/, 1)[0] || '';
    let commas = 0, semicolons = 0, inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') {
        if (inQuotes && firstLine[i + 1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && ch === ',') commas++;
      else if (!inQuotes && ch === ';') semicolons++;
    }
    return semicolons > commas ? ';' : ',';
  }

  // CSV → πίνακας γραμμών, κάθε γραμμή πίνακας από κείμενα. Αφαιρεί το BOM και παραλείπει
  // τις εντελώς κενές γραμμές. Εισαγωγικά μόνο στην αρχή πεδίου· "" μέσα σε αυτά είναι ένα ".
  //   options.delimiter: ',' ή ';', ή 'auto' (προεπιλογή) για εντοπισμό από την πρώτη γραμμή.
  function parse(text, options = {}) {
    const source = String(text ?? '').replace(BOM, '');
    const delimiter = !options.delimiter || options.delimiter === 'auto' ? detectDelimiter(source) : options.delimiter;
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (inQuotes) {
        if (ch === '"') {
          if (source[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"' && field === '') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(value => value !== '')) rows.push(row);
        row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) {
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
    }
    return rows;
  }

  // Τιμή σε εισαγωγικά για CSV, με διπλασιασμένα τα εσωτερικά εισαγωγικά.
  function quote(value) { return '"' + String(value ?? '').replace(/"/g, '""') + '"'; }

  // ---- Κείμενο ----
  // Χωρίς τόνους και διαλυτικά (π.χ. «Πέμπτη» → «Πεμπτη»), με την ίδια κανονική μορφή Unicode.
  function withoutTones(value) { return String(value ?? '').normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC'); }

  // Ονόματα ημερών που χρησιμοποιούν τα αρχεία FET (D1–D5, ελληνικά ή αγγλικά, με ή χωρίς τόνους).
  const DAY_ALIASES = [
    ['d1', 'δευτερα', 'δευ', 'δε', 'monday', 'mon'],
    ['d2', 'τριτη', 'τρι', 'τρ', 'tuesday', 'tue'],
    ['d3', 'τεταρτη', 'τετ', 'τε', 'wednesday', 'wed'],
    ['d4', 'πεμπτη', 'πεμ', 'πε', 'thursday', 'thu'],
    ['d5', 'παρασκευη', 'παρ', 'πα', 'friday', 'fri']
  ];
  // Όνομα ημέρας → 0 (Δευτέρα) … 4 (Παρασκευή), ή −1 όταν δεν αναγνωρίζεται.
  function weekdayIndex(name) {
    const clean = withoutTones(name).toLowerCase().replace(/[^a-zα-ω0-9]/g, '');
    return DAY_ALIASES.findIndex(aliases => aliases.includes(clean));
  }

  // Κλειδί σύγκρισης: χωρίς τόνους, κεφαλαία, χωρίς κενά (π.χ. «ΣΤ1» και «Στ1» ταιριάζουν).
  // Kept in a cache: the fields of the Documents Templater compare the same few names thousands of times.
  const compareKeyCache = new Map();
  const compareKey = value => {
    const text = String(value ?? '');
    let key = compareKeyCache.get(text);
    if (key === undefined) {
      if (compareKeyCache.size >= 50000) compareKeyCache.clear();
      key = withoutTones(text).toUpperCase().replace(/\s+/g, '');
      compareKeyCache.set(text, key);
    }
    return key;
  };

  // ---- Ημερομηνίες ----
  const pad = (number, size = 2) => String(number).padStart(size, '0');
  // true όταν η τιμή είναι υπαρκτή ημερομηνία στη μορφή 'YYYY-MM-DD'.
  function isoValid(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
    if (!match) return false;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  // 'YYYY-MM-DD' → dd/mm/yyyy. Κενό ή μη έγκυρη τιμή → ''.
  function formatDate(value) {
    if (!isoValid(value)) return '';
    const [year, month, day] = value.split('-');
    return day + '/' + month + '/' + year;
  }
  // Κείμενο του χρήστη (dd/mm/yyyy, και d/m/yyyy, με «/», «.» ή «-») → 'YYYY-MM-DD'. Μη έγκυρο → ''.
  function parseDate(value) {
    const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(String(value ?? ''));
    if (!match) return '';
    const iso = match[3] + '-' + pad(match[2]) + '-' + pad(match[1]);
    return isoValid(iso) ? iso : '';
  }
  // Σχολικό έτος 'YYYY-YYYY' → {from, to}: 1 Σεπτεμβρίου έως 31 Αυγούστου. Μη έγκυρο → null.
  function schoolYearRange(year) {
    const match = /^(\d{4})-(\d{4})$/.exec(String(year ?? ''));
    if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
    return {from: match[1] + '-09-01', to: match[2] + '-08-31'};
  }
  // Τελευταία ημέρα διδασκαλίας για ανοιχτή περίοδο: 15 Ιουνίου του έτους λήξης.
  function schoolYearTeachingEnd(year) {
    return schoolYearRange(year) ? String(year).slice(5) + '-06-15' : '';
  }
  function inSchoolYear(value, year) {
    const range = schoolYearRange(year);
    return !!range && isoValid(value) && value >= range.from && value <= range.to;
  }
  // Η σημερινή ημερομηνία του υπολογιστή, ως 'YYYY-MM-DD'.
  function today() {
    const now = new Date();
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }
  // Ημέρα της εβδομάδας: 1 = Δευτέρα … 7 = Κυριακή. Μη έγκυρη ημερομηνία → 0.
  function isoWeekday(value) {
    if (!isoValid(value)) return 0;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  }

  const uid = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const clone = value => structuredClone(value);
  const unique = list => [...new Set(list)];
  const minutes = time => { const [h, m] = String(time).split(':').map(Number); return h * 60 + m; };
  const clock = total => pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  const nowIso = () => new Date().toISOString();
  const quoted = value => '«' + value + '»';
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const dateRangeText = (from, to) => to ? (from === to ? formatDate(from) : formatDate(from) + '–' + formatDate(to)) : 'από ' + formatDate(from) + ' και μετά';

  // =============================================================================================
  // ---- Τμήματα (classesByYear) ----
  // =============================================================================================
  // Τμήμα Γενικής Παιδείας: {id, name, grade, number, homeroomStaffId}. grade: 'Α', 'Β', 'Γ', 'Δ', 'Ε' ή 'Στ'·
  // number: θετικός ακέραιος. Ορίζονται στη δημιουργία και δεν αλλάζουν· μαζί είναι το κλειδί του τμήματος
  // («Α1», «Στ1»), ανεξάρτητα από τη γραφή του name (π.χ. «Α-1»). Άλλο τμήμα (π.χ. «Τμήμα Ένταξης»):
  // {id, name, homeroomStaffId}, χωρίς grade και number· το είδος το καθορίζει η ύπαρξη του grade.
  // Τα δεδομένα αναφέρονται στα τμήματα με το id, και τα ονόματα για εμφάνιση παίρνονται από τα Τμήματα.

  // Οι τάξεις με τη σειρά τους, στην εσωτερική γραφή (χωρίς τόνους, κεφαλαία: 'ΣΤ').
  const GRADES = Object.freeze(['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ']);
  const GRADE_LABELS = Object.freeze({Α: "Α'", Β: "Β'", Γ: "Γ'", Δ: "Δ'", Ε: "Ε'", ΣΤ: "Στ'"});
  // Αποστρόφοι που γράφονται μετά το γράμμα της τάξης («Β'», «Β΄», «Β’»).
  const gradeKey = value => compareKey(value).replace(/['΄’ʹ`´ʼ]/g, '');
  // Η γραφή της τάξης στα δεδομένα: 'ΣΤ' → 'Στ'.
  const gradeName = internal => internal === 'ΣΤ' ? 'Στ' : internal;
  const gradeIndex = grade => GRADES.indexOf(gradeKey(grade));
  // «Α1» → {grade:'Α', number:1}· «Στ2» → {grade:'ΣΤ', number:2}· αλλιώς null.
  function classParts(name) {
    const match = /^(ΣΤ|[ΑΒΓΔΕ])(\d+)$/.exec(compareKey(name));
    return match && Number(match[2]) > 0 ? {grade: match[1], number: Number(match[2])} : null;
  }
  // Η κανονική γραφή ενός ονόματος τμήματος Γενικής Παιδείας: «ΣΤ1», «στ1», «Στ 1» → «Στ1»· «α2», «Ά2» → «Α2».
  // Χωρίς τόνους, κενά και διάκριση πεζών–κεφαλαίων. Τιμή που δεν είναι γράμματα τάξης (Α–Στ) και αριθμός → ''.
  function classSpelling(name) {
    const parts = classParts(name);
    return parts ? gradeName(parts.grade) + parts.number : '';
  }

  // Τμήμα Γενικής Παιδείας; (έχει έγκυρα grade και number)
  function isGeneralClass(record) {
    return isObject(record) && gradeIndex(record.grade) >= 0 && Number.isInteger(record.number) && record.number > 0;
  }
  // Το κλειδί ενός τμήματος Γενικής Παιδείας («Α1», «Στ1»)· για άλλο τμήμα → ''.
  function classKey(record) {
    return isGeneralClass(record) ? gradeName(GRADES[gradeIndex(record.grade)]) + record.number : '';
  }
  const classCollator = new Intl.Collator('el', {sensitivity: 'base', numeric: true});
  // Ταξινόμηση: πρώτα τα τμήματα Γενικής Παιδείας κατά τάξη και αριθμό, μετά τα άλλα αλφαβητικά. Νέος πίνακας.
  function sortClasses(classes) {
    return [...(classes || [])].filter(isObject).sort((a, b) => {
      const ga = isGeneralClass(a), gb = isGeneralClass(b);
      if (ga !== gb) return ga ? -1 : 1;
      if (ga) return gradeIndex(a.grade) - gradeIndex(b.grade) || a.number - b.number;
      return classCollator.compare(String(a.name ?? ''), String(b.name ?? ''));
    });
  }
  // Τα τμήματα ανά id (Map). Δέχεται και έτοιμο Map.
  function classesById(classes) {
    if (classes instanceof Map) return classes;
    return new Map((classes || []).filter(item => isObject(item) && item.id).map(item => [item.id, item]));
  }
  // Το όνομα ενός τμήματος από τα Τμήματα, ή '' όταν δεν υπάρχει.
  function classNameOf(classes, id) { return String(classesById(classes).get(id)?.name ?? ''); }
  // Οι τάξεις με τα τμήματά τους (μόνο Γενικής Παιδείας), με τη σειρά τους:
  //   [{grade:'Στ', label:"Στ'", index:5, classes:[τμήματα…]}]. Μόνο τάξεις που έχουν τμήματα.
  function classGrades(classes) {
    const result = [];
    for (const record of sortClasses(classes).filter(isGeneralClass)) {
      const internal = GRADES[gradeIndex(record.grade)];
      let entry = result.find(item => item.index === GRADES.indexOf(internal));
      if (!entry) result.push(entry = {grade: gradeName(internal), label: GRADE_LABELS[internal], index: GRADES.indexOf(internal), classes: []});
      entry.classes.push(record);
    }
    return result;
  }
  // Μετονομασία: σε τμήμα Γενικής Παιδείας επιτρέπεται μόνο αλλαγή γραφής. Το όνομα, χωρίς σημεία στίξης και
  // κενά (και χωρίς τόνους και διάκριση πεζών–κεφαλαίων), πρέπει να είναι το κλειδί του τμήματος: «Α-1», «Α'1»,
  // «Α_1», «ΣΤ 1» γίνονται δεκτά· «Α11» για το Α1, «ΑΓ1», «Σ1» για το Στ1 όχι. → το μήνυμα λάθους, ή ''. Άλλο
  // τμήμα, ή κενό όνομα (το κενό το ελέγχει η εφαρμογή) → ''.
  const RENAME_ERROR = 'Η τάξη και ο αριθμός δεν αλλάζουν. Για νέο τμήμα χρησιμοποίησε «+ Προσθήκη».';
  function classRenameError(record, name) {
    if (!isGeneralClass(record)) return '';
    const plain = compareKey(name).replace(/[^\p{L}\p{N}]/gu, '');
    if (!plain) return '';
    return plain === compareKey(classKey(record)) ? '' : RENAME_ERROR;
  }

  // Κοινή αντιστοίχιση ονομάτων των αρχείων (FET, CSV) σε τμήματα, για όλες τις εισαγωγές.
  //   classes: τα τμήματα του έτους, μαζί με όσα δεν έχουν αποθηκευτεί ακόμη· options.limit: το όριο πλήθους
  //   τμημάτων του έτους (προαιρετικό).
  // → {resolve, find, grade, classes, newClasses, overLimit}:
  //   resolve(name) → id ή null. Όνομα τμήματος Γενικής Παιδείας («ΣΤ1», «Α1») → το τμήμα με αυτό το κλειδί·
  //     αν δεν υπάρχει, δημιουργείται (newClasses, με τελικό id), εκτός αν θα ξεπερνούσε το όριο (overLimit).
  //     Κάθε άλλο όνομα → άλλο τμήμα με το ίδιο όνομα (χωρίς τόνους, κενά και διάκριση πεζών–κεφαλαίων)·
  //     αν δεν βρεθεί, δεν δημιουργείται → null (ο εισαγωγέας το βάζει στο otherStudents).
  //   find(name): όπως το resolve, χωρίς δημιουργία.
  //   grade("Β'" ή 'Β') → τα id των τμημάτων Γενικής Παιδείας της τάξης, με τη σειρά τους.
  //   classes: όλα τα τμήματα (υπάρχοντα και νέα)· overLimit: τμήματα που δεν δημιουργήθηκαν λόγω ορίου.
  // Δέχεται και έτοιμο resolver, και τότε τον επιστρέφει όπως είναι.
  function classResolver(classes, options = {}) {
    if (classes && !Array.isArray(classes) && typeof classes.resolve === 'function') return classes;
    const all = (classes || []).filter(item => isObject(item) && item.id);
    const newClasses = [], overLimit = [];
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : Infinity;
    const byKey = new Map(), byName = new Map();
    const index = record => {
      if (isGeneralClass(record)) { const key = classKey(record); if (!byKey.has(key)) byKey.set(key, record); }
      else { const key = compareKey(record.name); if (key && !byName.has(key)) byName.set(key, record); }
    };
    all.forEach(index);
    const find = name => {
      const spelled = classSpelling(name);
      return (spelled ? byKey.get(spelled) : byName.get(compareKey(name)))?.id || null;
    };
    const resolve = name => {
      const found = find(name);
      if (found) return found;
      const spelled = classSpelling(name);
      if (!spelled) return null;
      if (all.length >= limit) { if (!overLimit.includes(spelled)) overLimit.push(spelled); return null; }
      const parts = classParts(spelled);
      const record = {id: uid(), name: spelled, grade: gradeName(parts.grade), number: parts.number, homeroomStaffId: ''};
      all.push(record); newClasses.push(record); index(record);
      return record.id;
    };
    const grade = value => {
      const internal = gradeKey(value);
      return sortClasses(all).filter(record => isGeneralClass(record) && GRADES[gradeIndex(record.grade)] === internal).map(record => record.id);
    };
    return {resolve, find, grade, get classes() { return all; }, newClasses, overLimit};
  }

  // ---- Προσωπικό ----
  // «Δάσκαλος» = κλάδος ακριβώς ΠΕ70, ανεξάρτητα από το είδος υπηρεσίας (π.χ. και ο/η Υπεύθυνος/η
  // Ολοημέρου). Το ΠΕ70.50 (Ειδική Αγωγή) δεν μετρά. Οι ειδικότητες κρίνονται από το serviceType.
  function isGeneralTeacher(person) { return compareKey(person?.branch) === 'ΠΕ70'; }

  // Το Προσωπικό με τη σειρά της λίστας «Σύντομο Όνομα» (shortNameOrder). Όσοι δεν έχουν θέση
  // ακολουθούν, κατά σύντομο όνομα. Επιστρέφει νέο πίνακα· ο αρχικός δεν αλλάζει.
  function sortStaff(staff) {
    const position = person => Number.isInteger(person?.shortNameOrder) ? person.shortNameOrder : Infinity;
    const name = person => String(person?.shortName || person?.name || '');
    return [...(staff || [])].sort((a, b) => {
      const pa = position(a), pb = position(b);
      return (pa === pb ? 0 : pa < pb ? -1 : 1) || name(a).localeCompare(name(b), 'el', {numeric: true, sensitivity: 'base'});
    });
  }


  // Αλφαβητική σειρά πλήρους ονόματος, ανεξάρτητα από το shortNameOrder.
  function sortStaffAlphabetically(staff) {
    const collator = new Intl.Collator('el', {sensitivity: 'base', numeric: true});
    const name = person => String(person?.name || person?.shortName || '');
    return [...(staff || [])].sort((a, b) => collator.compare(name(a), name(b)) || String(a?.id || '').localeCompare(String(b?.id || '')));
  }

  // ---- Μαθητές (studentsByYear) ----
  // Ο Αριθμός Μητρώου δεν είναι ταυτότητα: σπάνια δύο μαθητές έχουν τον ίδιο. Ταυτότητα είναι μόνο το id.
  // Στις εισαγωγές, ίδιος μαθητής είναι αυτός με ίδιο Αριθμό Μητρώου ΚΑΙ ίδιο επώνυμο και όνομα (χωρίς τόνους,
  // κενά και διάκριση πεζών–κεφαλαίων).
  const studentKey = student => [String(student?.registryNumber ?? '').trim(), compareKey(student?.lastName), compareKey(student?.firstName)].join('\u0001');
  const sameStudent = (a, b) => studentKey(a) === studentKey(b);
  const nameCollator = new Intl.Collator('el', {sensitivity: 'base', numeric: true});
  // Ταξινόμηση μαθητών: επώνυμο, όνομα, όνομα πατέρα, Αριθμός Μητρώου.
  function compareStudents(a, b) {
    for (const key of ['lastName', 'firstName', 'fatherName', 'registryNumber']) {
      const order = nameCollator.compare(String(a?.[key] ?? '').trim(), String(b?.[key] ?? '').trim());
      if (order) return order;
    }
    return 0;
  }
  // Οι συναρτήσεις τάξης, προαγωγής και ΑΔΥΜ δέχονται την εγγραφή τμήματος από τα Τμήματα (classesByYear) και
  // αφορούν μόνο τμήματα Γενικής Παιδείας: υπολογίζονται από τα grade και number, όχι από το όνομα.
  // Η τάξη ενός τμήματος: {grade:'Στ', number:2} → {grade:'Στ', label:"Στ'", index:5, number:2}· άλλο τμήμα → null.
  function classGrade(record) {
    if (!isGeneralClass(record)) return null;
    const index = gradeIndex(record.grade);
    return {grade: gradeName(GRADES[index]), label: GRADE_LABELS[GRADES[index]], index, number: record.number};
  }
  // Το κλειδί του τμήματος της επόμενης χρονιάς, με τον ίδιο αριθμό: Β2 → «Γ2», Ε1 → «Στ1». Η Στ' και τα άλλα
  // τμήματα δεν έχουν επόμενο → ''. Το τμήμα του τρέχοντος έτους βρίσκεται (ή δημιουργείται) με το
  // SchoolClasses.resolver.
  function promotedClass(record) {
    const index = isGeneralClass(record) ? gradeIndex(record.grade) : -1;
    if (index < 0 || index >= GRADES.length - 1) return '';
    return gradeName(GRADES[index + 1]) + record.number;
  }
  // ΑΔΥΜ: συμπληρώνεται στην Α' και στη Δ'. Η ημερομηνία πρέπει να είναι από την έναρξη της σχολικής χρονιάς
  // στην οποία ο μαθητής ήταν στην Α' (για Α', Β', Γ') ή στη Δ' (για Δ', Ε', Στ'). Για το 2026-2027: Α', Δ' από
  // 01/09/2026· Β', Ε' από 01/09/2025· Γ', Στ' από 01/09/2024. Άλλο τμήμα ή έτος που δεν αναγνωρίζεται → ''.
  function adymRequiredFrom(record, year) {
    const range = schoolYearRange(year);
    if (!isGeneralClass(record) || !range) return '';
    const index = gradeIndex(record.grade), back = index < 3 ? index : index - 3;
    return (Number(range.from.slice(0, 4)) - back) + '-09-01';
  }
  // Κατάσταση ΑΔΥΜ (υπολογίζεται, δεν αποθηκεύεται): χωρίς ημερομηνία → 'pending' («Εκκρεμεί»)· ημερομηνία
  // πριν από την adymRequiredFrom → 'expired' («Έληξε»)· αλλιώς 'valid' («Σε ισχύ»).
  function adymStatus(date, record, year) {
    const requiredFrom = adymRequiredFrom(record, year);
    if (!isoValid(date)) return {status: 'pending', label: 'Εκκρεμεί', requiredFrom};
    if (requiredFrom && date < requiredFrom) return {status: 'expired', label: 'Έληξε', requiredFrom};
    return {status: 'valid', label: 'Σε ισχύ', requiredFrom};
  }

  // CSV μαθητών του myschool («Γενικά στοιχεία μαθητών»), με «;»: γραμμές στοιχείων σχολείου, «Σχολικό έτος;
  // 2026-2027», και ανά τμήμα: «Τμήμα: ;;;Α1», «Τάξη Εγγραφής: …», επικεφαλίδα «Α/Α;Αριθμός μητρώου;Επώνυμο
  // μαθητή;Όνομα μαθητή;Όνομα πατέρα» και μία γραμμή ανά μαθητή. Οι στήλες βρίσκονται από την επικεφαλίδα.
  // Το κείμενο πρέπει να έχει ήδη αποκωδικοποιηθεί (το αρχείο του myschool είναι Windows-1253).
  // → {ok, errors, warnings, info, year, classes:[{raw, name, students:[{registryNumber, lastName, firstName,
  //    fatherName}]}], count}· name: η κανονική γραφή («ΣΤ1» → «Στ1»).
  function parseStudentsCsv(text) {
    const errors = [], warnings = [], info = [], classes = [];
    const rows = parse(text, {delimiter: 'auto'});
    const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
    let year = '', columns = null, current = null, count = 0;
    const seen = new Map();
    rows.forEach((row, index) => {
      const line = index + 1, cells = row.map(clean), first = compareKey(cells[0]);
      const yearAt = cells.findIndex(cell => compareKey(cell) === 'ΣΧΟΛΙΚΟΕΤΟΣ');
      if (yearAt >= 0) { year = cells.slice(yearAt + 1).find(cell => /^\d{4}-\d{4}$/.test(cell)) || year; return; }
      if (first.startsWith('ΤΜΗΜΑ')) {
        const raw = cells.slice(1).find(Boolean) || clean(cells[0].replace(/^[^:]*:/, ''));
        const name = classSpelling(raw);
        current = {raw, name, students: []};
        if (!name) errors.push(`Το «${raw || '(κενό)'}» στη γραμμή ${line} δεν είναι τμήμα (τάξη και αριθμός, π.χ. «Α1», «Στ2»).`);
        else {
          const same = classes.find(item => item.name === name);
          if (same) current = same; else classes.push(current);
        }
        return;
      }
      if (cells.some(cell => compareKey(cell) === 'ΑΡΙΘΜΟΣΜΗΤΡΩΟΥ')) {
        const find = test => cells.findIndex(cell => test(compareKey(cell)));
        columns = {
          registry: find(key => key === 'ΑΡΙΘΜΟΣΜΗΤΡΩΟΥ'),
          last: find(key => key.startsWith('ΕΠΩΝΥΜΟ')),
          first: find(key => key.startsWith('ΟΝΟΜΑ') && !key.includes('ΠΑΤΕΡΑ') && !key.includes('ΜΗΤΕΡΑ')),
          father: find(key => key.includes('ΠΑΤΕΡΑ'))
        };
        if (columns.last < 0 || columns.first < 0) { errors.push(`Η επικεφαλίδα στη γραμμή ${line} δεν έχει στήλες «Επώνυμο μαθητή» και «Όνομα μαθητή».`); columns = null; }
        return;
      }
      if (!columns || !/^\d+$/.test(cells[0])) return;
      if (!current) { errors.push(`Η γραμμή ${line} έχει μαθητή πριν από τη γραμμή «Τμήμα:».`); return; }
      if (!current.name) return;
      const student = {
        registryNumber: columns.registry >= 0 ? clean(cells[columns.registry]) : '',
        lastName: clean(cells[columns.last]), firstName: clean(cells[columns.first]),
        fatherName: columns.father >= 0 ? clean(cells[columns.father]) : ''
      };
      if (!student.lastName || !student.firstName || !student.registryNumber) {
        warnings.push(`Η γραμμή ${line} (${current.name}) δεν έχει Αριθμό Μητρώου, επώνυμο ή όνομα και δεν εισάγεται.`);
        return;
      }
      const key = studentKey(student), before = seen.get(key);
      if (before) { warnings.push(`Ο/Η ${student.lastName} ${student.firstName} (Α.Μ. ${student.registryNumber}) εμφανίζεται δύο φορές (${before} και ${current.name}). Εισάγεται μία φορά, στο ${before}.`); return; }
      seen.set(key, current.name);
      current.students.push(student); count++;
    });
    for (const item of classes) if (!item.students.length) info.push(`Το τμήμα ${item.name} δεν έχει μαθητές στο αρχείο.`);
    const registry = new Map();
    for (const item of classes) for (const student of item.students) {
      const list = registry.get(student.registryNumber) || [];
      list.push(`${student.lastName} ${student.firstName} (${item.name})`); registry.set(student.registryNumber, list);
    }
    for (const [number, list] of registry) if (list.length > 1) warnings.push(`Ο Αριθμός Μητρώου ${number} υπάρχει σε περισσότερους από έναν μαθητές: ${list.join(', ')}.`);
    if (!errors.length && !count) errors.push('Δεν βρέθηκαν μαθητές στο αρχείο. Βεβαιώσου ότι είναι το CSV «Γενικά στοιχεία μαθητών» του myschool, με γραμμές «Τμήμα:» και επικεφαλίδα «Αριθμός μητρώου».');
    return {ok: !errors.length, errors, warnings, info, year, classes, count};
  }

  // ---- Κείμενο με μορφοποίηση (HTML του schoolRichText) ----
  // Κρατά μόνο ό,τι γράφει ο editor: έντονα, πλάγια, υπογράμμιση, χρώμα κειμένου (span με style color),
  // παραγράφους, αλλαγές γραμμής και λίστες (ul, ol, li). Κάθε άλλο στοιχείο αφαιρείται και μένει το
  // περιεχόμενό του (εκτός από script, style κ.ά., που φεύγουν ολόκληρα)· οι ιδιότητες αφαιρούνται όλες,
  // εκτός από το χρώμα. Το <font color> γίνεται span.
  const HTML_TAGS = new Set(['b','strong','i','em','u','span','p','div','font','ul','ol','li']);
  // Στοιχεία που φεύγουν μαζί με το περιεχόμενό τους (π.χ. από επικόλληση ιστοσελίδας ή Word).
  const HTML_DROP = new Set(['script','style','template','noscript','iframe','object','embed','svg','math','head','title','meta','link','xml']);
  const HTML_COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;
  function sanitizeHtml(input) {
    const doc = new DOMParser().parseFromString(String(input || ''), 'text/html');
    const copy = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return document.createElement('br');
      if (HTML_DROP.has(tag)) return document.createDocumentFragment();
      if (!HTML_TAGS.has(tag)) { const fragment = document.createDocumentFragment(); [...node.childNodes].forEach(child => fragment.append(copy(child))); return fragment; }
      const element = document.createElement(tag === 'font' ? 'span' : tag);
      if (tag === 'span' || tag === 'font') {
        const color = (node.style.color || node.getAttribute('color') || '').trim();
        if (HTML_COLOR.test(color)) element.style.color = color;
      }
      [...node.childNodes].forEach(child => element.append(copy(child)));
      return element;
    };
    const out = document.createElement('div');
    [...doc.body.childNodes].forEach(child => out.append(copy(child)));
    return out.innerHTML;
  }
  // true όταν το HTML έχει ορατό κείμενο (όχι μόνο ετικέτες, αλλαγές γραμμής, κενά ή κενές λίστες).
  function htmlHasText(html) {
    return !!String(html || '').replace(/<br\s*\/?\s*>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '');
  }

  // ---- Ετικέτες (tagsByYear) ----
  // Μητρώο του έτους: tagsByYear[year] = {general:[{id, name, color}], colors:{classes, staff, students}}.
  // Αναφορά σε ετικέτα: {type:'general'|'class'|'staff'|'student', id}. Τα ονόματα και τα χρώματα για εμφάνιση
  // παίρνονται πάντα από το μητρώο, τα Τμήματα, το Προσωπικό και τους Μαθητές, ώστε μια μετονομασία να περνά παντού.
  const TAG_TYPES = Object.freeze(['general', 'class', 'staff', 'student']);
  const TAG_DISPLAY_ORDER = Object.freeze(['staff', 'class', 'student', 'general']);
  // Το χρώμα κάθε κατηγορίας στο colors του μητρώου.
  const TAG_COLOR_KEYS = Object.freeze({class: 'classes', staff: 'staff', student: 'students'});
  const TAG_DEFAULT_COLORS = Object.freeze({classes: '#242e49', staff: '#554b4b', students: '#242e49'});
  const TAG_NEW_COLOR = '#a8d8ff';
  const tagColorValid = value => /^#[0-9a-f]{6}$/.test(String(value ?? '').trim().toLowerCase());
  const tagCollator = new Intl.Collator('el', {sensitivity: 'base', numeric: true});
  // Σύγκριση ονομάτων γενικών ετικετών: χωρίς τόνους, κενά και διάκριση πεζών–κεφαλαίων.
  const tagNameKey = name => compareKey(name);
  const sameTag = (a, b) => !!a && !!b && a.type === b.type && a.id === b.id;
  // Οι αναφορές μιας εφαρμογής: μόνο έγκυρες μορφές, χωρίς διπλές, με τη σειρά τους. Νέος πίνακας.
  function cleanTagRefs(refs) {
    const out = [], seen = new Set();
    for (const ref of Array.isArray(refs) ? refs : []) {
      if (!isObject(ref) || !TAG_TYPES.includes(ref.type) || typeof ref.id !== 'string' || !ref.id) continue;
      const key = ref.type + '\u0001' + ref.id;
      if (seen.has(key)) continue;
      seen.add(key); out.push({type: ref.type, id: ref.id});
    }
    return out;
  }
  // Τα χρώματα κατηγορίας του έτους, με τις προεπιλογές όπου λείπουν: {classes, staff, students}.
  function tagColors(tags) {
    const colors = isObject(tags?.colors) ? tags.colors : {}, out = {};
    for (const [key, fallback] of Object.entries(TAG_DEFAULT_COLORS)) out[key] = tagColorValid(colors[key]) ? String(colors[key]).trim().toLowerCase() : fallback;
    return out;
  }
  const tagGeneral = tags => Array.isArray(tags?.general) ? tags.general.filter(item => isObject(item) && typeof item.id === 'string') : [];
  // Ευρετήρια για εμφάνιση και ταξινόμηση. data = {tags, classes, staff, students}.
  function tagIndex(data) {
    const classes = classesById(data?.classes || []);
    const byId = list => new Map((Array.isArray(list) ? list : []).filter(item => isObject(item) && item.id).map(item => [item.id, item]));
    return {general: byId(tagGeneral(data?.tags)), classes, staff: byId(data?.staff), students: byId(data?.students), colors: tagColors(data?.tags)};
  }
  const tagText = value => String(value ?? '').trim();
  const staffTagLabel = person => tagText(person?.name) || tagText(person?.shortName) || tagText(person?.code) || 'χωρίς όνομα';
  // «ΕΠΩΝΥΜΟ Όνομα (Α1)», με το όνομα του τμήματος από τα Τμήματα.
  function studentTagLabel(student, classes) {
    const name = [tagText(student?.lastName), tagText(student?.firstName)].filter(Boolean).join(' ') || 'χωρίς όνομα';
    const className = classNameOf(classes, student?.classId);
    return className ? name + ' (' + className + ')' : name;
  }
  // Όνομα και χρώμα μιας ετικέτας → {type, label, color, missing}. Αναφορά που δεν βρίσκεται: «?», missing:true.
  function resolveTag(ref, data) {
    const index = tagIndex(data), type = ref?.type, id = ref?.id;
    const missing = color => ({type, label: '?', color, missing: true});
    if (type === 'general') {
      const item = index.general.get(id);
      return item ? {type, label: tagText(item.name) || '?', color: tagColorValid(item.color) ? item.color.toLowerCase() : TAG_NEW_COLOR, missing: false} : missing('#ffffff');
    }
    const color = index.colors[TAG_COLOR_KEYS[type]] || '#ffffff';
    if (type === 'class') { const item = index.classes.get(id); return item ? {type, label: tagText(item.name) || '?', color, missing: false} : missing(color); }
    if (type === 'staff') { const item = index.staff.get(id); return item ? {type, label: staffTagLabel(item), color, missing: false} : missing(color); }
    if (type === 'student') { const item = index.students.get(id); return item ? {type, label: studentTagLabel(item, index.classes), color, missing: false} : missing(color); }
    return missing('#ffffff');
  }
  // Η κοινή σειρά: εκπαιδευτικοί (αλφαβητικά κατά πλήρες όνομα, όπως στον επιλογέα), τμήματα, μαθητές, γενικές.
  // Μέσα στην κάθε κατηγορία διατηρείται η αντίστοιχη ταξινόμηση. Όσες δεν βρίσκονται στο τέλος της κατηγορίας τους.
  function sortTags(refs, data) {
    const index = tagIndex(data), list = cleanTagRefs(refs);
    const classOrder = new Map(sortClasses([...index.classes.values()]).map((item, position) => [item.id, position]));
    const staffOrder = new Map(sortStaffAlphabetically([...index.staff.values()]).map((item, position) => [item.id, position]));
    const far = Number.MAX_SAFE_INTEGER;
    const compare = (a, b) => {
      const ta = TAG_DISPLAY_ORDER.indexOf(a.type), tb = TAG_DISPLAY_ORDER.indexOf(b.type);
      if (ta !== tb) return ta - tb;
      if (a.type === 'general') {
        const ga = index.general.get(a.id), gb = index.general.get(b.id);
        if (!ga || !gb) return (ga ? 0 : 1) - (gb ? 0 : 1);
        return tagCollator.compare(tagText(ga.name), tagText(gb.name));
      }
      if (a.type === 'class') return (classOrder.get(a.id) ?? far) - (classOrder.get(b.id) ?? far);
      if (a.type === 'staff') return (staffOrder.get(a.id) ?? far) - (staffOrder.get(b.id) ?? far);
      const sa = index.students.get(a.id), sb = index.students.get(b.id);
      if (!sa || !sb) return (sa ? 0 : 1) - (sb ? 0 : 1);
      return (classOrder.get(sa.classId) ?? far) - (classOrder.get(sb.classId) ?? far) || compareStudents(sa, sb);
    };
    return list.sort(compare);
  }

  // ---- Τα _data*.js ----
  // Τα αρχεία που φορτώθηκαν. Κάθε επόμενο αρχείο ελέγχει στην αρχή ότι υπάρχουν όσα χρειάζεται (needs) και
  // δηλώνει στο τέλος ότι φορτώθηκε (loaded).
  const loadedFiles = ['_data.js'];
  function needsFiles(file, files) {
    const missing = files.filter(name => !loadedFiles.includes(name));
    if (!missing.length) return;
    throw Error((missing.length > 1 ? 'Λείπουν τα αρχεία ' + missing.slice(0, -1).join(', ') + ' και ' + missing[missing.length - 1] + ', που φορτώνονται' : 'Λείπει το αρχείο ' + missing[0] + ', που φορτώνεται')
      + ' πριν από το ' + file + '. Βεβαιώσου ότι η σελίδα φορτώνει τα _data.js, _data_timetable.js, _data_oloimero.js και _data_documents.js, με αυτή τη σειρά, και ότι είναι η τελευταία έκδοση.');
  }
  const loadedFile = file => { if (!loadedFiles.includes(file)) loadedFiles.push(file); };

  // Οι εσωτερικοί βοηθοί για τα _data_timetable.js, _data_oloimero.js και _data_documents.js. Τα επόμενα αρχεία
  // προσθέτουν εδώ ό,τι χρειάζονται τα μεθεπόμενα.
  window.SchoolDataParts = {needs: needsFiles, loaded: loadedFile, BOM, detectDelimiter, parse, quote, weekdayIndex,
    compareKey, pad, isoValid, formatDate, schoolYearTeachingEnd, today, isoWeekday, uid, clone, unique, minutes,
    clock, nowIso, quoted, isObject, dateRangeText, GRADES, GRADE_LABELS, gradeKey, gradeName, gradeIndex,
    isGeneralClass, classKey, classCollator, sortClasses, classesById, classNameOf, classGrades, classResolver,
    isGeneralTeacher, sortStaff, classSpelling, sortStaffAlphabetically};

  window.SchoolTags = Object.freeze({
    TYPES: TAG_TYPES, COLOR_KEYS: TAG_COLOR_KEYS, DEFAULT_COLORS: TAG_DEFAULT_COLORS, NEW_COLOR: TAG_NEW_COLOR,
    colors: tagColors, resolve: resolveTag, sort: sortTags, same: sameTag, nameKey: tagNameKey, clean: cleanTagRefs,
    validColor: tagColorValid, staffLabel: staffTagLabel, studentLabel: studentTagLabel
  });
  window.SchoolHtml = Object.freeze({sanitize: sanitizeHtml, hasText: htmlHasText});
  window.SchoolText = Object.freeze({withoutTones, weekdayIndex});
  window.SchoolDate = Object.freeze({valid: isoValid, format: formatDate, parse: parseDate, schoolYear: schoolYearRange, schoolYearTeachingEnd, inSchoolYear, today, weekday: isoWeekday});
  window.SchoolClasses = Object.freeze({
    isGeneral: isGeneralClass, key: classKey, sort: sortClasses, byId: classesById, nameOf: classNameOf,
    grades: classGrades, renameError: classRenameError, resolver: classResolver
  });
  window.SchoolStudents = Object.freeze({
    parseCsv: parseStudentsCsv, studentKey, sameStudent, compare: compareStudents,
    classGrade, promotedClass, adymRequiredFrom, adymStatus
  });
})();
