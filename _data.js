/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων
 * Έκδοση αρχείου: 0.37
 * Όνομα κατά την εγκατάσταση: _data.js
 *
 * Φορτώνεται από όσες υποεφαρμογές διαβάζουν ή γράφουν CSV, FET, ημερομηνίες ή προγράμματα, μετά
 * το _ui.js και πριν από το δικό τους script: <script src="_data.js"></script>. Δεν έχει δικό του
 * περιβάλλον χρήστη: δεν ανοίγει διαλόγους και δεν γράφει στη σελίδα.
 * Ορίζει:
 *   window.SchoolCsv        ανάγνωση και γραφή CSV
 *   window.SchoolFet        ανάγνωση αρχείων FET (XML)
 *   window.SchoolText       κανονικοποίηση ελληνικού κειμένου, ονόματα ημερών
 *   window.SchoolDate       ημερομηνίες: dd/mm/yyyy για τον χρήστη, 'YYYY-MM-DD' για την αποθήκευση
 *   window.SchoolClasses    τμήματα (classesByYear): είδος, κλειδί («Α1»), ταξινόμηση, τάξεις, μετονομασία,
 *                           αντιστοίχιση ονομάτων των αρχείων σε τμήματα (με αυτόματη δημιουργία τμημάτων
 *                           Γενικής Παιδείας)
 *   window.SchoolTimetable  προγράμματα (timetablesByYear): ώρες, περίοδοι, υπεύθυνοι τμημάτων,
 *                           εμφάνιση μαθητών, συγκρούσεις, ώρες ανά εκπαιδευτικό, διαθεσιμότητα,
 *                           αντικαταστάσεις, Εισαγωγή Ολοημέρου στο ωρολόγιο, εισαγωγείς ανά είδος
 *                           (από FET και από το CSV του Ολοήμερου Designer), εξαγωγή CSV του Ολοημέρου
 *                           για το FET, μαθητές των κελιών του Ολοημέρου από ονόματα, δάσκαλοι και σειρά του Προσωπικού, κανονική γραφή τμημάτων,
 *                           απασχόληση εκπαιδευτικών σε ημερομηνία και ώρα (συνεδριάσεις)
 *   window.SchoolHtml       κείμενο με μορφοποίηση (HTML του schoolRichText): καθαρισμός, έλεγχος κενού
 *   window.SchoolStudents   μαθητές (studentsByYear): ανάγνωση του CSV μαθητών του myschool, ίδιος μαθητής,
 *                           τάξη και επόμενο τμήμα, κατάσταση ΑΔΥΜ, ταξινόμηση
 *   window.SchoolTags       ετικέτες (tagsByYear): κατηγορίες, χρώματα κατηγορίας, όνομα και χρώμα κάθε ετικέτας,
 *                           κοινή σειρά, σύγκριση ονομάτων γενικών ετικετών
 *   window.SchoolDocumentFields  πεδία από το κοινό αρχείο για τα πρότυπα του Documents Templater ({{@…}}):
 *                           κατάλογος, αναγνώριση και υποδείξεις, αν ένα πεδίο χρειάζεται περίοδο, άγκυρες, είδος προτύπου, τιμές για
 *                           εκπαιδευτικό ή τμήμα σε μια περίοδο, έτοιμος πίνακας του πλέγματος και των μαθημάτων, ονόματα εγγράφων
 * Τα προγράμματα είναι στη μορφή formatVersion:2: οι δραστηριότητες αναφέρονται στα τμήματα με το id τους
 * (classes), και τα ονόματα μαθητών των αρχείων που δεν είναι τμήματα μπαίνουν στο otherStudents.
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

  // CSV προσωπικού: εντοπίζει τα πεδία με τις θέσεις τους ώστε τα υπόλοιπα bytes/σχόλια
  // (ακόμη και τα μεταδεδομένα του Designer) να μην επαναδημιουργούνται κατά την ενημέρωση.
  function staffCsvCells(source) {
    const delimiter=detectDelimiter(source),rows=[];let cells=[],start=0,value='',quoted=false,inQuotes=false;
    const finishCell=end=>{cells.push({start,end,value,quoted});value='';quoted=false;start=end+1};
    const finishRow=()=>{rows.push(cells);cells=[]};
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(inQuotes){if(ch==='"'){if(source[i+1]==='"'){value+='"';i++}else inQuotes=false}else value+=ch;continue}
      if(ch==='"'&&i===start){inQuotes=true;quoted=true;continue}
      if(ch===delimiter){finishCell(i);continue}
      if(ch==='\r'||ch==='\n'){
        const end=i;finishCell(end);finishRow();if(ch==='\r'&&source[i+1]==='\n')i++;start=i+1;continue
      }
      value+=ch;
    }
    if(inQuotes)throw Error('Το CSV περιέχει πεδίο με εισαγωγικά που δεν κλείνουν.');
    if(start<source.length||cells.length){finishCell(source.length);finishRow()}
    return rows;
  }
  function staffCsvRead(source) {
    if(typeof source!=='string')throw Error('Μη έγκυρο περιεχόμενο CSV.');
    const rows=staffCsvCells(source),header=rows.find(r=>r.length>1&&r.some(c=>c.value.trim()==='Teachers'));
    if(!header)throw Error('Το CSV δεν έχει στήλη «Teachers».');
    const idx=header.findIndex(c=>c.value.trim()==='Teachers');
    if(header.filter(c=>c.value.trim()==='Teachers').length!==1)throw Error('Το CSV έχει περισσότερες από μία στήλες «Teachers».');
    const names=new Set();let count=0;
    for(const row of rows.slice(rows.indexOf(header)+1)){
      if(row.length===1&&row[0].value.trim()==='# OLOIMERO_DESIGNER_JSON_BEGIN')break;
      if(row.length!==header.length)continue; // σχόλια, κενές γραμμές, μεταδεδομένα
      const cell=row[idx];if(!cell.value.trim())continue;
      count++;
      for(const item of cell.value.split('+'))if(item.trim())names.add(item.trim());
    }
    return {names:[...names],rows:count};
  }
  function staffCsvUpdate(source,mapping) {
    const rows=staffCsvCells(source),header=rows.find(r=>r.length>1&&r.some(c=>c.value.trim()==='Teachers'));
    if(!header||header.filter(c=>c.value.trim()==='Teachers').length!==1)throw Error('Το CSV δεν έχει μοναδική στήλη «Teachers».');
    const idx=header.findIndex(c=>c.value.trim()==='Teachers'),changes=[];let replacements=0;
    for(const row of rows.slice(rows.indexOf(header)+1)){
      if(row.length===1&&row[0].value.trim()==='# OLOIMERO_DESIGNER_JSON_BEGIN')break;
      if(row.length!==header.length)continue;
      const cell=row[idx];if(!cell.value.trim())continue;
      const result=cell.value.split('+').map(part=>{
        const old=part.trim(),target=mapping[old];
        if(!old||typeof target!=='string'||!target.trim()||target===old)return part;
        replacements++;return part.replace(old,target);
      }).join('+');
      if(result!==cell.value)changes.push({start:cell.start,end:cell.end,text:cell.quoted?quote(result):result});
    }
    let output=source;for(const c of changes.reverse())output=output.slice(0,c.start)+c.text+output.slice(c.end);
    return {text:output,replacements};
  }
  // Ακριβές όνομα ή μοναδικό πρόθεμα που τελειώνει σε « - ...»· χωρίς αυθαίρετη επιλογή.
  function staffCsvSuggest(names,staff) {
    const current=staff.map(p=>String(p.shortName||'').trim()).filter(Boolean),out={};
    for(const name of names){
      const exact=current.filter(n=>n===name);
      if(exact.length===1){out[name]=exact[0];continue}
      const more=current.filter(n=>n.startsWith(name+' - '));
      out[name]=more.length===1?more[0]:'';
    }
    return out;
  }

  // ---- FET ----
  const child = (node, tag) => node ? [...node.children].find(item => item.tagName === tag) : undefined;
  const children = (node, tag) => node ? [...node.children].filter(item => item.tagName === tag) : [];
  // Το κείμενο του άμεσου παιδιού tag (ή κενό). Χωρίς trim: όπου χρειάζεται, το κάνει η εφαρμογή.
  const text = (node, tag) => child(node, tag)?.textContent || '';

  // Ανάλυση αρχείου FET. Ελέγχει ότι είναι XML με ρίζα <fet> και ότι έχει ως άμεσα παιδιά της ρίζας
  // τις λίστες του options.require (π.χ. ['Teachers_List']). Αλλιώς πετά λάθος με το options.message.
  function parseFet(xml, options = {}) {
    const doc = new DOMParser().parseFromString(String(xml ?? '').replace(BOM, ''), 'application/xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root?.tagName !== 'fet' || (options.require || []).some(tag => !child(root, tag))) {
      throw Error(options.message || 'Το αρχείο δεν είναι έγκυρο αρχείο FET.');
    }
    return doc;
  }

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

  // =============================================================================================
  // ---- Προγράμματα ----
  // =============================================================================================

  // Κατάλογος ειδών προγραμμάτων. Τα δικαιώματα εγγραφής και οι validators του source μένουν στο host.
  //   owner: η εφαρμογή-κάτοχος (null: δεν υπάρχει ακόμη)· ownerTitle: το όνομά της για τον χρήστη·
  //   counts: μετρά στις ώρες και στη διαθεσιμότητα·
  //   importers: οι εισαγωγείς του είδους (βλέπε «Εισαγωγείς» παρακάτω)· κενό όταν δεν υπάρχει εισαγωγή.
  // Νέο είδος: μια εγγραφή εδώ (με εισαγωγέα, αν η εφαρμογή του εξάγει αρχείο), και στο host τα
  // δικαιώματα και ο validator του source.
  const KINDS = Object.freeze({
    school: Object.freeze({label: 'Ωρολόγιο', owner: 'fet_timetable_editor.html', ownerTitle: 'FET Timetable Editor', counts: true, importers: Object.freeze([fetImporter()])}),
    oloimero: Object.freeze({label: 'Ολοήμερο', owner: 'oloimero_designer.html', ownerTitle: 'Ολοήμερο Designer', counts: false, importers: Object.freeze([oloimeroImporter()])}),
    individual: Object.freeze({label: 'Ατομικά Προγράμματα', owner: null, ownerTitle: '', counts: true, importers: Object.freeze([])})
  });
  const countsInHours = kind => !!KINDS[kind]?.counts;
  // Οι εισαγωγείς ενός είδους, και ένας συγκεκριμένος εισαγωγέας (ή null).
  const importersOf = kind => KINDS[kind]?.importers || [];
  const importerOf = (kind, id) => importersOf(kind).find(item => item.id === id) || null;

  // Χαρακτηρισμοί των Ωρών Διδασκαλίας, με τη σειρά τους μέσα στη μέρα.
  const HOUR_GROUPS = Object.freeze(['early', 'morning', 'meal', 'afternoon', 'extended', 'break']);
  const DAY_KEYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri']);
  const DAY_LABELS = Object.freeze(['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή']);

  // Διαθεσιμότητα: οι δύο σταθερές του κανόνα.
  const STAY_MINUTES = 6 * 60;          // 6 ώρες παραμονής στο σχολείο
  const EARLY_ARRIVAL_MINUTES = 15;     // άφιξη 15 λεπτά νωρίτερα από την πρώτη ζώνη

  const uid = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const clone = value => structuredClone(value);
  const unique = list => [...new Set(list)];
  const minutes = time => { const [h, m] = String(time).split(':').map(Number); return h * 60 + m; };
  const clock = total => pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  const nowIso = () => new Date().toISOString();
  const quoted = value => '«' + value + '»';
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const dateRangeText = (from, to) => to ? (from === to ? formatDate(from) : formatDate(from) + '–' + formatDate(to)) : 'από ' + formatDate(from) + ' και μετά';

  // ---- Ώρες ----
  // Χρονικό διάστημα «HH:MM-HH:MM» (και «H:MM», με «-», «–», «—», «−» και κενά) → {start, end}, ή null.
  function parseTimeRange(value) {
    const match = /^\s*(\d{1,2})[:.](\d{2})\s*[-–—−]\s*(\d{1,2})[:.](\d{2})\s*$/.exec(String(value ?? ''));
    if (!match) return null;
    const [h1, m1, h2, m2] = match.slice(1).map(Number);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
    const start = pad(h1) + ':' + pad(m1), end = pad(h2) + ':' + pad(m2);
    return start < end ? {start, end} : null;
  }
  // Πραγματικές ώρες μιας ώρας των Ωρών Διδασκαλίας: από το name, αλλιώς από το longName.
  function hourTimes(hour) { return parseTimeRange(hour?.name) || parseTimeRange(hour?.longName); }

  // Οι ώρες των Ωρών Διδασκαλίας με τις πραγματικές τους ώρες ({hour, name, category, fetTag, start, end}),
  // με τη σειρά τους. Πετά λάθος για ώρα που δεν διαβάζεται ως «HH:MM-HH:MM».
  function timedHours(teachingHours) {
    const hours = teachingHours?.hours || [];
    if (!hours.length) throw Error('Δεν έχουν καταχωριστεί Ώρες Διδασκαλίας για το σχολικό έτος. Συμπλήρωσέ τες πρώτα στις «Ώρες Διδασκαλίας».');
    return hours.map(hour => {
      const times = hourTimes(hour);
      if (!times) throw Error('Η ώρα ' + quoted(hour.name) + ' των Ωρών Διδασκαλίας δεν έχει χρονικό διάστημα «HH:MM-HH:MM» ούτε στο όνομα ούτε στην περιγραφή. Διόρθωσέ την στις «Ώρες Διδασκαλίας».');
      return {hour, name: String(hour.name).trim(), category: hour.category || '', fetTag: String(hour.fetTag || '').trim(), ...times};
    });
  }

  // Ώρες ανά χαρακτηρισμό: {early:[…], morning:[…], …}, κάθε ομάδα με τη σειρά των Ωρών Διδασκαλίας.
  function hourGroups(teachingHours) {
    const groups = Object.fromEntries(HOUR_GROUPS.map(key => [key, []]));
    for (const item of timedHours(teachingHours)) if (groups[item.category]) groups[item.category].push(item);
    return groups;
  }

  // ---- Περίοδοι ----
  // Κενή λήξη: 15 Ιουνίου του σχολικού έτους της έναρξης. Το αποθηκευμένο `to` μένει κενό.
  // Χωρίς ρητό έτος, η έναρξη Σεπ.–Δεκ. ανήκει στο έτος που αρχίζει τότε,
  // ενώ η έναρξη Ιαν.–Αύγ. στο σχολικό έτος που άρχισε το προηγούμενο ημερολογιακό έτος.
  function periodEnd(period, year) {
    if (period?.to) return period.to;
    if (!year && isoValid(period?.from)) {
      const start = Number(period.from.slice(0, 4));
      const beginning = Number(period.from.slice(5, 7)) >= 9 ? start : start - 1;
      year = beginning + '-' + (beginning + 1);
    }
    return schoolYearTeachingEnd(year);
  }
  // Ισχύει η περίοδος στην ημερομηνία; το άκρο είναι συμπεριληπτικό.
  const periodCovers = (period, date) => isoValid(period?.from) && isoValid(date) && date >= period.from && date <= periodEnd(period);

  // Η περίοδος που ισχύει σε μια ημερομηνία: σε επικάλυψη, αυτή που είναι πιο κάτω στη λίστα.
  function periodAt(periods, date) {
    const list = periods || [];
    for (let i = list.length - 1; i >= 0; i--) if (periodCovers(list[i], date)) return list[i];
    return null;
  }
  // Το πρόγραμμα ενός είδους που ισχύει σε μια ημερομηνία (timetables = timetablesByYear[year]), ή null.
  function programAt(timetables, kind, date) {
    const period = periodAt(timetables?.periods, date);
    return period ? (timetables.programs || []).find(program => program.kind === kind && program.periodId === period.id) || null : null;
  }
  // Όλα τα προγράμματα που ισχύουν σε μια ημερομηνία, ένα ανά είδος.
  function programsAt(timetables, date) {
    const period = periodAt(timetables?.periods, date);
    return period ? (timetables.programs || []).filter(program => program.periodId === period.id) : [];
  }

  // Προειδοποιήσεις για τη λίστα περιόδων (δεν εμποδίζουν την αποθήκευση):
  //   overlap: επικάλυψη δύο περιόδων· openEnd: κενό «έως» σε περίοδο που δεν είναι τελευταία·
  //   order: «έως» πριν από το «από».
  // Κάθε προειδοποίηση: {type, periodIds, message}.
  function periodWarnings(periods) {
    const list = periods || [], warnings = [];
    list.forEach((period, index) => {
      if (!period.to && index < list.length - 1) warnings.push({type: 'openEnd', periodIds: [period.id], message: 'Η περίοδος ' + quoted(period.name) + ' δεν έχει ημερομηνία λήξης, αλλά δεν είναι η τελευταία της λίστας.'});
      if (period.to && period.from && period.to < period.from) warnings.push({type: 'order', periodIds: [period.id], message: 'Η περίοδος ' + quoted(period.name) + ' λήγει πριν αρχίσει.'});
    });
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!isoValid(a.from) || !isoValid(b.from) || (a.to && a.to < a.from) || (b.to && b.to < b.from)) continue;
      const from = a.from > b.from ? a.from : b.from;
      const endA = periodEnd(a), endB = periodEnd(b);
      const to = endA < endB ? endA : endB;
      if (!to || to < from) continue;
      warnings.push({type: 'overlap', periodIds: [a.id, b.id], from, to, message: 'Οι περίοδοι ' + quoted(a.name) + ' και ' + quoted(b.name) + ' επικαλύπτονται: ' + (to ? 'στις ' : '') + dateRangeText(from, to) + ' ισχύει η ' + quoted(b.name) + '.'});
    }
    return warnings;
  }

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

  // ---- Μαθητές μιας δραστηριότητας ----
  // Οι δραστηριότητες κρατούν: classes (id τμημάτων), subsets (υποσύνολα: ονόματα ομάδων του FET, π.χ.
  // «Ε1-Γαλ», και, με τον κανόνα των μεικτών δραστηριοτήτων, τα id των ολόκληρων τμημάτων), otherStudents
  // (ονόματα μαθητών του αρχείου που δεν είναι τμήματα).
  // Συνδυασμός: classes = ολόκληρα τμήματα και τα τμήματα των υποσυνόλων· όταν υπάρχουν υποσύνολα, μπαίνουν
  // στα subsets και τα ολόκληρα τμήματα (και τα υποσύνολά τους, extra), ώστε ο έλεγχος συγκρούσεων να μη
  // χάνει την επικάλυψη στο ολόκληρο τμήμα.
  function combineStudents(whole, subsets, other, extra = () => []) {
    const ids = unique(whole);
    const result = {classes: unique([...ids, ...subsets.map(item => item.classId).filter(Boolean)]), subsets: [], otherStudents: unique(other)};
    if (subsets.length) result.subsets = unique([...subsets.map(item => item.name), ...ids.flatMap(id => [id, ...extra(id)])]);
    return result;
  }

  // Ευρετήριο της ιεραρχίας των μαθητών του FET ([{name, groups:[{name, subgroups:[…]}]}]):
  // όνομα → {type:'year'|'group'|'subgroup', groups:[…], parent}.
  function studentsIndex(hierarchy) {
    const index = new Map(), add = (name, entry) => { if (name && !index.has(name)) index.set(name, entry); };
    const subgroupsOf = new Map();
    for (const year of hierarchy || []) {
      add(year.name, {type: 'year', groups: unique((year.groups || []).map(group => group.name))});
      for (const group of year.groups || []) {
        add(group.name, {type: 'group', groups: [group.name]});
        subgroupsOf.set(group.name, unique([...(subgroupsOf.get(group.name) || []), ...(group.subgroups || [])]));
        for (const subgroup of group.subgroups || []) add(subgroup, {type: 'subgroup', groups: [group.name], parent: group.name});
      }
    }
    return {index, subgroupsOf};
  }

  // «Students Sets» του FET (π.χ. «Β1+Δ'», «Ε1-Γαλ+Ε2-Γαλ», «Α'-Στ'») → {classes, subsets, otherStudents, unknown}.
  //   Οι τάξεις (Years) αναπτύσσονται στα Groups τους με την ιεραρχία του FET, και κάθε Group αντιστοιχίζεται
  //   σε τμήμα με το resolver (όσα τμήματα Γενικής Παιδείας λείπουν δημιουργούνται). Υποσύνολα (Subgroups)
  //   μπαίνουν στα subsets ως κείμενο, με το τμήμα τους στα classes. Groups που δεν είναι τμήματα → otherStudents.
  //   unknown: σύνολα που δεν υπάρχουν στην ιεραρχία (αντιστοιχίζονται κι αυτά με το resolver).
  //   resolver: SchoolClasses.resolver, ή τα τμήματα του έτους.
  function expandStudents(value, hierarchy, resolver) {
    const {index, subgroupsOf} = hierarchy instanceof Map ? {index: hierarchy, subgroupsOf: new Map()} : (hierarchy?.index ? hierarchy : studentsIndex(hierarchy));
    const classes = classResolver(resolver);
    const parts = String(value ?? '').split('+').map(part => part.trim()).filter(Boolean);
    const whole = [], subsets = [], other = [], unknown = [], origin = new Map();
    const remember = (id, name) => { if (id && !origin.has(id)) origin.set(id, name); };
    const add = name => { const id = classes.resolve(name); if (id) { whole.push(id); remember(id, name); } else other.push(name); };
    for (const part of parts) {
      const entry = index.get(part);
      if (!entry) { unknown.push(part); add(part); }
      else if (entry.type === 'subgroup') { const id = classes.resolve(entry.parent); remember(id, entry.parent); subsets.push({name: part, classId: id}); }
      else entry.groups.forEach(add);
    }
    return {...combineStudents(whole, subsets, other, id => subgroupsOf.get(origin.get(id)) || []), unknown: unique(unknown)};
  }

  // Το τμήμα ενός υποσυνόλου από το όνομά του («Ε1-Γαλ»: τμήμα, «-», όνομα) → id ή null. Για τμήμα Γενικής
  // Παιδείας με το κλειδί (ώστε να ισχύει και μετά από μετονομασία, π.χ. «Ε-1»), για άλλο τμήμα με το όνομα.
  function subsetParent(name, classes) {
    const key = compareKey(name);
    const general = /^((?:ΣΤ|[ΑΒΓΔΕ])\d+)[-–_](.+)$/.exec(key);
    if (general) { const id = classes.resolve(general[1]); if (id) return id; }
    const others = classes.classes.filter(record => !isGeneralClass(record)).map(record => ({id: record.id, key: compareKey(record.name)})).filter(item => item.key).sort((a, b) => b.key.length - a.key.length);
    return others.find(item => key.length > item.key.length + 1 && key.startsWith(item.key) && /[-–_]/.test(key[item.key.length]))?.id || null;
  }

  // Ονόματα ομάδων μαθητών χωρίς ιεραρχία του FET (π.χ. του Ολοήμερου Designer: «Α1», «Β'», «Α'-Στ'», «Ε1-Γαλ»,
  // ή «Β1+Δ'») → τα μέρη τους: {grades:['Α', …'Στ'], classIds:[…], subsets:[{name, classId}], other:[…]}.
  //   τάξη («Β'») → grades· εύρος τάξεων («Α'-Στ'») → οι τάξεις του· τμήμα → classIds (με το resolver)·
  //   υποσύνολο («Ε1-Γαλ») → subsets, με το τμήμα του· οτιδήποτε άλλο → other.
  function studentsParts(value, resolver) {
    const classes = classResolver(resolver);
    const parts = (Array.isArray(value) ? value : String(value ?? '').split('+')).map(part => String(part).trim()).filter(Boolean);
    const out = {grades: [], classIds: [], subsets: [], other: []};
    for (const part of parts) {
      const plain = gradeKey(part);
      const grade = /^(ΣΤ|[ΑΒΓΔΕ])$/.exec(plain);
      if (grade) { out.grades.push(gradeName(grade[1])); continue; }
      const range = /^(ΣΤ|[ΑΒΓΔΕ])[-–—](ΣΤ|[ΑΒΓΔΕ])$/.exec(plain);
      if (range) {
        const from = GRADES.indexOf(range[1]), to = GRADES.indexOf(range[2]);
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) out.grades.push(gradeName(GRADES[i]));
        continue;
      }
      const id = classes.resolve(part);
      if (id) { out.classIds.push(id); continue; }
      const parent = subsetParent(part, classes);
      if (parent) { out.subsets.push({name: part, classId: parent}); continue; }
      out.other.push(part);
    }
    out.grades = unique(out.grades); out.classIds = unique(out.classIds); out.other = unique(out.other);
    out.subsets = out.subsets.filter((item, index) => out.subsets.findIndex(other => other.name === item.name) === index);
    return out;
  }
  // Τα τμήματα μιας τάξης → id· τάξη χωρίς τμήματα → το όνομά της στο other.
  const expandGrade = (classes, grade, whole, other) => {
    const ids = classes.grade(grade);
    if (ids.length) whole.push(...ids); else other.push(GRADE_LABELS[gradeKey(grade)] || String(grade));
  };

  // Ονόματα ομάδων μαθητών χωρίς ιεραρχία (βλέπε studentsParts) → {classes, subsets, otherStudents}: οι τάξεις
  // αναπτύσσονται στα τμήματα που υπάρχουν (τάξη χωρίς τμήματα → otherStudents), με τους κανόνες των
  // μεικτών δραστηριοτήτων. resolver: SchoolClasses.resolver, ή τα τμήματα του έτους.
  function studentsFromNames(value, resolver) {
    const classes = classResolver(resolver), parts = studentsParts(value, classes);
    const whole = [...parts.classIds], other = [...parts.other];
    parts.grades.forEach(grade => expandGrade(classes, grade, whole, other));
    return combineStudents(whole, parts.subsets, other);
  }

  // ---- Εμφάνιση μαθητών ----
  // Το κείμενο που δείχνουν όλες οι εφαρμογές για τους μαθητές μιας δραστηριότητας. Υπολογίζεται από τα
  // classes / subsets / otherStudents και τα Τμήματα (ctx.classes) και δεν αποθηκεύεται. Τα ονόματα από τα Τμήματα.
  //   ένα τμήμα ή ένα υποσύνολο → όπως είναι («Α1», «Ε1-Γαλ»)·
  //   ολόκληρη τάξη → «Β'» (τάξη με ένα μόνο τμήμα → το τμήμα)· μερική τάξη → τα τμήματα («Β1»)·
  //   τρεις ή περισσότερες συνεχόμενες ολόκληρες τάξεις → εύρος («Α'-Γ'», «Α'-Στ'»)· δύο, ή μη
  //   συνεχόμενες, χωριστά («Α', Β'»)· μετά τα άλλα τμήματα (αλφαβητικά), τα υποσύνολα, και στο τέλος τα
  //   otherStudents όπως είναι. Ένα id που δεν υπάρχει στα Τμήματα γράφεται «?». Διαχωριστικό «, ».
  // Τα υποσύνολα που προστέθηκαν μόνο για τον έλεγχο συγκρούσεων (το id ενός ολόκληρου τμήματος και τα
  // υποσύνολά του, που αναγνωρίζονται με το κλειδί του τμήματος) δεν εμφανίζονται.
  function studentsText(activity, ctx = {}) {
    const clean = list => unique((list || []).map(item => String(item ?? '').trim()).filter(Boolean));
    const ids = clean(activity?.classes), subsets = clean(activity?.subsets), other = clean(activity?.otherStudents);
    if (!ids.length && !subsets.length && !other.length) return '';
    const school = (ctx.classes || []).filter(isObject), byId = classesById(school);
    const subsetSet = new Set(subsets), mixed = subsets.length > 0;
    // Ολόκληρα τμήματα: χωρίς υποσύνολα όλα· με υποσύνολα, όσα υπάρχουν και στα subsets.
    const whole = new Set();
    let missing = false;
    for (const id of ids) {
      if (mixed && !subsetSet.has(id)) continue;
      if (byId.has(id)) whole.add(id); else missing = true;
    }
    const grades = classGrades(school), tokens = [];
    for (const {classes: list, index} of grades) {
      const present = list.filter(record => whole.has(record.id));
      if (!present.length) continue;
      if (present.length === list.length) tokens.push({index, full: true, label: list.length === 1 ? list[0].name : GRADE_LABELS[GRADES[index]]});
      else present.forEach(record => tokens.push({index, full: false, label: record.name}));
    }
    // Εύρος: τρεις ή περισσότερες ολόκληρες τάξεις, συνεχόμενες στις τάξεις του σχολείου.
    const order = grades.map(item => item.index), pieces = [];
    for (let i = 0; i < tokens.length;) {
      let j = i;
      while (tokens[i].full && j + 1 < tokens.length && tokens[j + 1].full && order.indexOf(tokens[j + 1].index) === order.indexOf(tokens[j].index) + 1) j++;
      if (tokens[i].full && j - i >= 2) { pieces.push(GRADE_LABELS[GRADES[tokens[i].index]] + '-' + GRADE_LABELS[GRADES[tokens[j].index]]); i = j + 1; }
      else { pieces.push(tokens[i].label); i++; }
    }
    const others = sortClasses(school.filter(record => !isGeneralClass(record) && whole.has(record.id))).map(record => String(record.name ?? ''));
    const prefixes = [...whole].map(id => byId.get(id)).map(record => compareKey(isGeneralClass(record) ? classKey(record) : record.name)).filter(Boolean);
    const shownSubsets = subsets.filter(name => {
      if (byId.has(name) || ids.includes(name)) return false;
      const key = compareKey(name);
      return !prefixes.some(prefix => key.length > prefix.length && key.startsWith(prefix) && /[-–_]/.test(key[prefix.length]));
    });
    return [...pieces, ...others, ...(missing ? ['?'] : []), ...shownSubsets, ...other].join(', ');
  }

  // ---- Υπεύθυνος τμήματος μέσα σε πρόγραμμα ----
  //   classId: το id του τμήματος· ctx: {classes, staff}.
  // → {id} για εκπαιδευτικό του Προσωπικού, {name} για όνομα χωρίς αντιστοίχιση, ή null.
  //   1. ο υπεύθυνος του τμήματος (homeroomStaffId), αν εμφανίζεται στο πρόγραμμα,
  //   2. αλλιώς, μόνο για τμήμα Γενικής Παιδείας, ο εκπαιδευτικός του προγράμματος που το σύντομο όνομά του
  //      (ή το αρχικό όνομα, για όσους δεν αντιστοιχίστηκαν) ξεκινά με «[κλειδί]», π.χ. «[Α1] - …», χωρίς
  //      διάκριση πεζών–κεφαλαίων και τόνων («[ΣΤ1]» για το Στ1).
  function homeroomTeacher(program, classId, ctx = {}) {
    const record = classesById(ctx.classes || []).get(classId);
    if (!record) return null;
    const activities = program?.activities || [];
    const ids = new Set(activities.flatMap(activity => activity.staff || []));
    if (record.homeroomStaffId && ids.has(record.homeroomStaffId)) return {id: record.homeroomStaffId};
    if (!isGeneralClass(record)) return null;
    const prefix = compareKey('[' + classKey(record) + ']');
    const byName = (ctx.staff || []).find(person => ids.has(person.id) && compareKey(person.shortName).startsWith(prefix));
    if (byName) return {id: byName.id};
    const name = unique(activities.flatMap(activity => activity.unmatched || [])).find(item => compareKey(item).startsWith(prefix));
    return name ? {name} : null;
  }

  // ---- Συγκρούσεις ----
  const timesOverlap = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;
  // Συγκρούονται στους μαθητές; Κοινό τμήμα (id), εκτός αν και οι δύο έχουν υποσύνολα χωρίς κοινό στοιχείο.
  // → τα id των κοινών τμημάτων. Τα otherStudents δεν συγκρίνονται.
  function studentsClash(a, b) {
    const common = (a.classes || []).filter(id => (b.classes || []).includes(id));
    if (!common.length) return [];
    if (a.subsets?.length && b.subsets?.length && !a.subsets.some(item => b.subsets.includes(item))) return [];
    return common;
  }
  // Συγκρούσεις μέσα σε ένα πρόγραμμα, ή σε πολλά μαζί (programs: πίνακας).
  // → [{type:'staff'|'unmatched'|'class', who, day, start, end, a, b}], όπου a, b οι δραστηριότητες και who
  //   το id του εκπαιδευτικού (staff), το όνομα χωρίς αντιστοίχιση (unmatched) ή το id του τμήματος (class).
  function conflicts(programs) {
    const list = Array.isArray(programs) ? programs : [programs];
    const slots = [];
    for (const program of list) for (const activity of program?.activities || []) for (const time of activity.times || []) slots.push({activity, time});
    const result = [];
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const x = slots[i], y = slots[j];
      if (x.activity === y.activity || !timesOverlap(x.time, y.time)) continue;
      const base = {day: x.time.day, start: x.time.start > y.time.start ? x.time.start : y.time.start, end: x.time.end < y.time.end ? x.time.end : y.time.end, a: x.activity, b: y.activity};
      for (const id of (x.activity.staff || []).filter(id => (y.activity.staff || []).includes(id))) result.push({type: 'staff', who: id, ...base});
      for (const name of (x.activity.unmatched || []).filter(name => (y.activity.unmatched || []).includes(name))) result.push({type: 'unmatched', who: name, ...base});
      for (const id of studentsClash(x.activity, y.activity)) result.push({type: 'class', who: id, ...base});
    }
    return result;
  }

  // ---- Ώρες ανά εκπαιδευτικό ----
  // Ώρες στο πρόγραμμα ανά id του Προσωπικού (Map), μόνο από τα είδη που μετρούν. Μία ώρα ανά εγγραφή
  // του times· μια δραστηριότητα με δύο εκπαιδευτικούς μετρά και στους δύο.
  function staffHours(programs) {
    const hours = new Map();
    for (const program of Array.isArray(programs) ? programs : [programs]) {
      if (!program || !countsInHours(program.kind)) continue;
      for (const activity of program.activities || []) for (const id of unique(activity.staff || [])) hours.set(id, (hours.get(id) || 0) + (activity.times || []).length);
    }
    return hours;
  }

  // ---- Διαθεσιμότητα ----
  // Οι ώρες μη διαθεσιμότητας ενός εκπαιδευτικού από το source ενός προγράμματος FET: [{day, start, end}].
  function unavailableTimes(program, staffId) {
    const source = program?.source;
    if (source?.type !== 'fet') return [];
    const names = new Set((source.teachers || []).filter(teacher => teacher.staffId === staffId).map(teacher => teacher.name));
    return (source.unavailable || []).filter(item => names.has(item.teacher)).map(({day, start, end}) => ({day, start, end}));
  }

  // Διαθεσιμότητα ενός εκπαιδευτικού μια ημέρα («Διαθέσιμοι Εκπαιδευτικοί»).
  //   options: {programs, person (εγγραφή του Προσωπικού), day (1–5), teachingHours}.
  //   Μετρούν μόνο τα είδη που μετρούν στις ώρες. Η διευθύντρια/ο διευθυντής (role 'director') → null.
  // → {from, to, earlyAndAfternoon, hours:[{hour, name, start, end, category, status}]}, όπου status:
  //   'free' διαθέσιμος, 'busy' έχει δραστηριότητα, 'unavailable' μη διαθέσιμος στο FET,
  //   'outside' εκτός του εξαώρου. Τα διαλείμματα δεν περιλαμβάνονται.
  function availability({programs, person, day, teachingHours}) {
    if (!person || person.role === 'director') return null;
    const counted = (Array.isArray(programs) ? programs : [programs]).filter(program => program && countsInHours(program.kind));
    const hours = timedHours(teachingHours);
    const own = counted.flatMap(program => (program.activities || []).filter(activity => (activity.staff || []).includes(person.id)).flatMap(activity => activity.times || [])).filter(time => time.day === day);
    const blocked = counted.flatMap(program => unavailableTimes(program, person.id)).filter(time => time.day === day);
    const overlapsAny = (slot, list) => list.some(time => slot.start < time.end && time.start < slot.end);
    const early = hours.filter(item => item.category === 'early'), morning = hours.filter(item => item.category === 'morning');
    const hasEarly = early.some(item => overlapsAny(item, own));
    const firstZone = hasEarly ? early[0] : morning[0] || hours.find(item => item.category !== 'break');
    let from = minutes(firstZone.start) - EARLY_ARRIVAL_MINUTES, to = from + STAY_MINUTES;
    const lastEnd = own.length ? Math.max(...own.map(time => minutes(time.end))) : 0;
    if (lastEnd > to) { to = lastEnd; from = to - STAY_MINUTES; }
    const afternoon = hours.filter(item => ['meal', 'afternoon', 'extended'].includes(item.category));
    return {
      from: clock(from), to: clock(to),
      earlyAndAfternoon: hasEarly && afternoon.some(item => overlapsAny(item, own)),
      hours: hours.filter(item => item.category !== 'break').map(item => ({
        hour: item.hour, name: item.name, start: item.start, end: item.end, category: item.category,
        status: overlapsAny(item, own) ? 'busy' : overlapsAny(item, blocked) ? 'unavailable' : (minutes(item.start) >= from && minutes(item.end) <= to ? 'free' : 'outside')
      }))
    };
  }

  // Ποιοι είναι απασχολημένοι σε μια ημερομηνία και ένα διάστημα ωρών (π.χ. την ώρα μιας συνεδρίασης),
  // σύμφωνα με τα προγράμματα της περιόδου που ισχύει τότε. Μετρούν μόνο τα είδη που μετρούν στις ώρες.
  //   timetables: timetablesByYear[year] ({periods, programs})· date: 'YYYY-MM-DD'· start, end: 'HH:MM'.
  // → {period, programs, lesson:Set(id), unavailable:Set(id)}:
  //   lesson       έχουν δραστηριότητα που επικαλύπτει το διάστημα,
  //   unavailable  είναι μη διαθέσιμοι στο FET σε ώρα που επικαλύπτει το διάστημα (και δεν είναι στο lesson).
  //   period είναι null όταν καμία περίοδος δεν ισχύει στην ημερομηνία· programs κενό όταν η περίοδος
  //   δεν έχει πρόγραμμα που μετρά.
  function staffBusyAt(timetables, date, start, end) {
    const period = periodAt(timetables?.periods, date);
    const programs = period ? programsAt(timetables, date).filter(program => countsInHours(program.kind)) : [];
    const lesson = new Set(), unavailable = new Set();
    const day = isoValid(date) ? isoWeekday(date) : 0, from = minutes(start), to = minutes(end);
    if (!day || !(from < to)) return {period, programs, lesson, unavailable};
    const overlaps = time => time?.day === day && minutes(time.start) < to && from < minutes(time.end);
    for (const program of programs) {
      for (const activity of program.activities || []) {
        if ((activity.times || []).some(overlaps)) for (const id of activity.staff || []) lesson.add(id);
      }
    }
    for (const program of programs) {
      if (program.source?.type !== 'fet') continue;
      for (const teacher of program.source.teachers || []) {
        if (!teacher?.staffId || lesson.has(teacher.staffId)) continue;
        if (unavailableTimes(program, teacher.staffId).some(overlaps)) unavailable.add(teacher.staffId);
      }
    }
    return {period, programs, lesson, unavailable};
  }

  // ---- Αντικαταστάσεις ----
  // Αντίγραφο προγράμματος με αντικαταστάσεις εκπαιδευτικών [{from:id, to:id}] (Α → Β).
  //   options.staff: το Προσωπικό, για τα ονόματα της σημείωσης. Ένα πρόγραμμα από FET που άλλαξε
  //   σημειώνεται «τροποποιήθηκε μετά την εισαγωγή» (source.modifiedAfterImport), μαζί με τις αντικαταστάσεις.
  //   Σε σχέδιο του Ολοήμερου Designer αλλάζουν και οι επιλεγμένοι εκπαιδευτικοί του source.
  // → {program, changed}: changed = πόσες δραστηριότητες άλλαξαν.
  function replaceStaff(program, replacements, options = {}) {
    const result = clone(program), map = new Map((replacements || []).filter(item => item.from && item.to && item.from !== item.to).map(item => [item.from, item.to]));
    let changed = 0;
    const used = new Set();
    for (const activity of result.activities || []) {
      if (!(activity.staff || []).some(id => map.has(id))) continue;
      activity.staff.forEach(id => { if (map.has(id)) used.add(id); });
      activity.staff = unique(activity.staff.map(id => map.get(id) || id));
      changed++;
    }
    if (changed) {
      const person = id => (options.staff || []).find(item => item.id === id);
      const name = id => person(id)?.name || '';
      result.updatedAt = options.now || nowIso();
      if (result.source?.type === 'fet') {
        const note = result.source.modifiedAfterImport || {replacements: []};
        note.at = result.updatedAt;
        note.replacements = [...(note.replacements || []), ...[...used].map(id => ({from: id, fromName: name(id), to: map.get(id), toName: name(map.get(id))}))];
        result.source.modifiedAfterImport = note;
      }
      if (result.source?.type === 'oloimero-designer' && Array.isArray(result.source.teachers)) {
        const teachers = [];
        for (const teacher of result.source.teachers) {
          const to = map.get(teacher?.staffId);
          const next = to ? {...teacher, staffId: to, name: person(to)?.shortName || teacher.name} : teacher;
          if (!next.staffId || !teachers.some(item => item.staffId === next.staffId)) teachers.push(next);
        }
        result.source.teachers = teachers;
      }
    }
    return {program: result, changed};
  }

  // ---- Ετικέτες ημέρας και ώρας (Ώρες Διδασκαλίας) ----
  function tagSets(teachingHours) {
    const dayTags = new Map(DAY_KEYS.map((key, index) => [String(teachingHours?.dayTags?.[key] || '').trim(), index + 1]).filter(([tag]) => tag));
    const hourTags = new Set((teachingHours?.hours || []).map(hour => String(hour.fetTag || '').trim()).filter(Boolean));
    return {dayTags, hourTags};
  }
  const tagsOf = value => (Array.isArray(value) ? value : String(value ?? '').split('+')).map(tag => String(tag).trim()).filter(Boolean);

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
  // ---- Εισαγωγή Ολοημέρου στο ωρολόγιο ----
  // =============================================================================================
  // Οι δραστηριότητες ενός σχεδίου του Ολοήμερου Designer (kind 'oloimero') συγκρίνονται μία προς μία με τις
  // δραστηριότητες ενός προγράμματος (του ωρολογίου) που είναι ολόκληρες σε ώρες Ολοημέρου: τις ώρες του
  // πίνακα του Designer (OLOIMERO_CATEGORIES: Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο). Όσες είναι ίδιες
  // μένουν όπως είναι (με το id τους και τα στοιχεία του FET)· όσες του ωρολογίου δεν έχουν ίδια στο σχέδιο
  // αφαιρούνται· όσες του σχεδίου δεν έχουν ίδια στο ωρολόγιο μπαίνουν. Δεν χρειάζονται Activity Id ή
  // ετικέτες FET: μάθημα, μαθητές, εκπαιδευτικοί, ημέρες και ώρες έρχονται από το σχέδιο.
  const timeText = time => (DAY_LABELS[time.day - 1] || 'ημέρα ' + time.day) + ' ' + time.start + '–' + time.end;
  const byTime = (a, b) => a.day - b.day || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  // «Ίδια» δραστηριότητα: ίδιο μάθημα, εκπαιδευτικοί, μαθητές, ημέρα και ώρες. Η αίθουσα δεν συγκρίνεται (το
  // σχέδιο δεν έχει αίθουσες). Οι μαθητές συγκρίνονται με τα τμήματα και το κείμενο του studentsText, όχι με τα
  // σκέτα subsets: η εισαγωγή από FET βάζει στα subsets και τα υποσύνολα των ολόκληρων τμημάτων, το σχέδιο όχι.
  // Τα τμήματα συγκρίνονται με το id τους.
  const sameKey = (activity, classes) => JSON.stringify([
    String(activity.subject || '').trim(), [...(activity.staff || [])].sort(), [...(activity.unmatched || [])].sort(),
    [...(activity.classes || [])].sort(), studentsText(activity, {classes}),
    (activity.times || []).map(time => time.day + ' ' + time.start + '-' + time.end).sort()
  ]);

  // Ανάλυση (δεν αλλάζει τίποτα).
  //   program: το ωρολόγιο· design: το σχέδιο του .data· options: {staff, classes, teachingHours, designName}
  //   (classes: τα Τμήματα του έτους).
  // → {ok, errors, warnings, info, unmatchedTeachers, kept:[id…], removed:[id…], added:[δραστηριότητες],
  //    unchanged, counts:{kept, removed, added}, designName}. kept: οι ίδιες, που μένουν· removed: του
  //    ωρολογίου που αφαιρούνται· added: του σχεδίου που μπαίνουν. Με λάθη η εισαγωγή δεν γίνεται:
  //   – δραστηριότητα του ωρολογίου με ώρες και μέσα και έξω από τις ώρες Ολοημέρου,
  //   – δραστηριότητα του σχεδίου σε ώρα που δεν είναι ώρα Ολοημέρου των Ωρών Διδασκαλίας,
  //   – εκπαιδευτικός του σχεδίου που δεν υπάρχει πια στο Προσωπικό.
  //   unchanged: όλες οι δραστηριότητες είναι ίδιες (τίποτα δεν αφαιρείται και τίποτα δεν μπαίνει).
  function analyzeOloimeroReplace(program, design, options = {}) {
    const result = {ok: false, errors: [], warnings: [], info: [], unmatchedTeachers: [], kept: [], removed: [], added: [], unchanged: false, counts: {}, designName: options.designName || design?.name || ''};
    const stop = message => { result.errors.push(message); return result; };
    if (!program) return stop('Δεν υπάρχει ωρολόγιο για την Εισαγωγή Ολοημέρου.');
    if (design?.kind !== 'oloimero') return stop('Το σχέδιο δεν είναι σχέδιο του Ολοήμερου Designer.');
    let hours;
    try { hours = oloimeroHours(options.teachingHours); } catch (error) { return stop(error.message); }
    if (!hours.length) return stop('Δεν έχουν οριστεί ώρες Πρωινής Ζώνης, Γεύματος, Ολοήμερου ή Διευρυμένου στις «Ώρες Διδασκαλίας».');
    const staff = options.staff || [], staffById = new Map(staff.map(person => [person.id, person])), classes = options.classes || [];
    // Μια ώρα είναι «ώρα Ολοημέρου» όταν χωρά ολόκληρη σε μια ώρα Ολοημέρου των Ωρών Διδασκαλίας.
    const inside = time => hours.some(hour => hour.start <= time.start && time.end <= hour.end);
    const touches = time => hours.some(hour => time.start < hour.end && hour.start < time.end);
    const describe = activity => {
      const people = [...(activity.staff || []).map(id => staffById.get(id)?.shortName || '?'), ...(activity.unmatched || [])].join(', ');
      const parts = [studentsText(activity, {classes}), people].filter(Boolean);
      return quoted(activity.subject || '—') + (parts.length ? ' (' + parts.join(' · ') + ')' : '');
    };
    const more = (count, one, many) => count > 0 ? ' Το ίδιο ισχύει για ' + count + ' ακόμη ' + (count === 1 ? one : many) + '.' : '';

    // Το ωρολόγιο: οι δραστηριότητές του σε ώρες Ολοημέρου.
    const mixed = [], current = [];
    for (const activity of program.activities || []) {
      const times = activity.times || [];
      if (!times.length) continue;
      const outside = times.filter(time => !inside(time));
      if (!outside.length) current.push(activity);
      else if (outside.length < times.length || outside.some(touches)) mixed.push(activity);
    }
    if (mixed.length) {
      const first = mixed[0];
      const times = [...first.times].sort(byTime).map(time => timeText(time) + (inside(time) ? ' (ώρα Ολοημέρου)' : ' (άλλη ώρα)')).join(', ');
      return stop('Η δραστηριότητα ' + describe(first) + ' του ωρολογίου έχει ώρες και μέσα και έξω από τις ώρες Ολοημέρου: ' + times + '.' +
        more(mixed.length - 1, 'δραστηριότητα', 'δραστηριότητες') +
        ' Η Εισαγωγή Ολοημέρου αντικαθιστά μόνο δραστηριότητες που είναι ολόκληρες σε ώρες Ολοημέρου (Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο). Χώρισε τη δραστηριότητα στο FET και δημιούργησε ξανά το ωρολόγιο, ή έλεγξε τις κατηγορίες των ωρών στις «Ώρες Διδασκαλίας».');
    }

    // Το σχέδιο: οι δραστηριότητές του, σε μορφή δραστηριότητας του ωρολογίου.
    const misplaced = [], unknownStaff = [], incoming = [];
    for (const activity of design.activities || []) {
      const times = activity.times || [];
      if (!times.length || times.some(time => !Number.isInteger(time.day) || time.day < 1 || time.day > 5 || !inside(time))) { misplaced.push(activity); continue; }
      if ((activity.staff || []).some(id => !staffById.has(id))) { unknownStaff.push(activity); continue; }
      incoming.push({
        id: uid(), subject: String(activity.subject || ''), staff: unique(activity.staff || []), unmatched: unique(activity.unmatched || []),
        classes: [...(activity.classes || [])], subsets: [...(activity.subsets || [])], otherStudents: [...(activity.otherStudents || [])], room: String(activity.room || ''),
        times: [...times].sort(byTime).map(({day, start, end}) => ({day, start, end}))
      });
    }
    const designText = quoted(result.designName || 'Σχέδιο');
    if (misplaced.length) {
      const first = misplaced[0], times = [...(first.times || [])].sort(byTime).map(timeText).join(', ');
      return stop('Η δραστηριότητα ' + describe(first) + ' του σχεδίου ' + designText + ' είναι σε ώρα που δεν είναι ώρα Ολοημέρου στις Ώρες Διδασκαλίας' + (times ? ' (' + times + ')' : '') + '.' +
        more(misplaced.length - 1, 'δραστηριότητα', 'δραστηριότητες') +
        ' Μάλλον οι Ώρες Διδασκαλίας άλλαξαν μετά το σχέδιο. Άνοιξε το σχέδιο στον Ολοήμερο Designer, έλεγξε τις θέσεις των δραστηριοτήτων και αποθήκευσέ το ξανά.');
    }
    if (unknownStaff.length) return stop('Το σχέδιο ' + designText + ' αναφέρεται σε εκπαιδευτικό που δεν υπάρχει πια στο Προσωπικό (δραστηριότητα ' + describe(unknownStaff[0]) + '). Άνοιξε το σχέδιο στον Ολοήμερο Designer και αποθήκευσέ το ξανά.');

    // Σύγκριση μία προς μία: κάθε δραστηριότητα του σχεδίου κρατά μία ίδια του ωρολογίου, αν υπάρχει.
    const waiting = new Map();
    for (const activity of current) {
      const key = sameKey(activity, classes);
      if (!waiting.has(key)) waiting.set(key, []);
      waiting.get(key).push(activity.id);
    }
    for (const activity of incoming) {
      const match = waiting.get(sameKey(activity, classes));
      if (match?.length) result.kept.push(match.shift());
      else result.added.push(activity);
    }
    const kept = new Set(result.kept);
    result.removed = current.filter(activity => !kept.has(activity.id)).map(activity => activity.id);
    result.unchanged = !result.removed.length && !result.added.length;
    result.counts = {kept: result.kept.length, removed: result.removed.length, added: result.added.length};

    // Εκπαιδευτικοί χωρίς αντιστοίχιση: μόνο όσοι μπαίνουν τώρα (οι ίδιες δραστηριότητες είναι ήδη στο ωρολόγιο).
    result.unmatchedTeachers = unique(result.added.flatMap(activity => activity.unmatched));
    if (result.unmatchedTeachers.length) result.warnings.push('Εκπαιδευτικοί του σχεδίου χωρίς αντιστοίχιση στο Προσωπικό: ' + result.unmatchedTeachers.map(quoted).join(', ') + '. Μπαίνουν στο ωρολόγιο χωρίς αντιστοίχιση.');
    if (!incoming.length && current.length) result.warnings.push('Το σχέδιο ' + designText + ' δεν έχει δραστηριότητες: η εισαγωγή αφαιρεί όλες τις δραστηριότητες Ολοημέρου του ωρολογίου.');
    const pending = Array.isArray(design.source?.pending) ? design.source.pending.length : 0;
    if (pending) result.info.push(pending === 1 ? 'Ένα ελλιπές κελί του σχεδίου (χωρίς εκπαιδευτικό, μάθημα ή μαθητές) δεν εισάγεται.' : pending + ' ελλιπή κελιά του σχεδίου (χωρίς εκπαιδευτικό, μάθημα ή μαθητές) δεν εισάγονται.');

    result.ok = true;
    return result;
  }

  // Εφαρμογή σε αντίγραφο του προγράμματος. Οι ίδιες δραστηριότητες μένουν όπως είναι· όσες αφαιρούνται
  // φεύγουν (και οι εγγραφές τους από το source.activities) και όσες μπαίνουν προστίθενται στο τέλος. Το
  // source.oloimero κρατά ποιο σχέδιο εισήχθη. Σε ωρολόγιο από FET που άλλαξε, το πρόγραμμα σημειώνεται
  // «τροποποιήθηκε μετά την εισαγωγή» (source.modifiedAfterImport.oloimero), γιατί δεν συμφωνεί πια με το
  // αρχείο του FET· χωρίς αλλαγές η σημείωση δεν μπαίνει.
  //   options: {designId (το id του σχεδίου στο .data), designName, now}.
  function applyOloimeroReplace(program, analysis, options = {}) {
    if (!analysis?.ok) throw Error('Η Εισαγωγή Ολοημέρου δεν μπορεί να γίνει: ' + (analysis?.errors?.[0] || 'δεν έγινε ανάλυση.'));
    const result = clone(program), removed = new Set(analysis.removed), at = options.now || nowIso();
    const name = analysis.designName || options.designName || '';
    result.activities = [...(result.activities || []).filter(activity => !removed.has(activity.id)), ...clone(analysis.added)];
    result.updatedAt = at;
    if (isObject(result.source)) {
      if (isObject(result.source.activities)) for (const id of removed) delete result.source.activities[id];
      result.source.oloimero = {design: options.designId || null, name, at};
      if (result.source.type === 'fet' && (removed.size || analysis.added.length)) {
        const note = isObject(result.source.modifiedAfterImport) ? result.source.modifiedAfterImport : {replacements: []};
        note.at = at;
        note.oloimero = {name, at};
        result.source.modifiedAfterImport = note;
      }
    }
    return result;
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
  const OLOIMERO_CATEGORIES = Object.freeze(['early', 'meal', 'afternoon', 'extended']);
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

  // Εξαγωγή CSV για το FET από ένα σχέδιο (προσχέδιο ή σχέδιο περιόδου). Στη στήλη «Teachers» μπαίνει το
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
  //   options: {unmatched:'keep'|'drop', kind ('oloimero'), name, periodId (ή null για προσχέδιο), id, now}.
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

  // ---- Εισαγωγή από FET ----
  const CSV_COLUMNS = Object.freeze({id: 'Activity Id', day: 'Day', hour: 'Hour', students: 'Students Sets', subject: 'Subject', teachers: 'Teachers', tags: 'Activity Tags', room: 'Room'});

  // Τα στοιχεία του .fet που κρατά το source.
  function readFetFile(fetText) {
    const doc = parseFet(fetText, {require: ['Days_List', 'Hours_List', 'Teachers_List', 'Students_List', 'Activities_List'], message: 'Το αρχείο .fet δεν είναι έγκυρο αρχείο FET με ημέρες, ώρες, εκπαιδευτικούς, μαθητές και δραστηριότητες.'});
    const root = doc.documentElement;
    const trimmed = (node, tag) => text(node, tag).trim();
    const days = children(child(root, 'Days_List'), 'Day').map(node => ({name: trimmed(node, 'Name'), longName: trimmed(node, 'Long_Name')}));
    const hours = children(child(root, 'Hours_List'), 'Hour').map(node => trimmed(node, 'Name'));
    const teachers = children(child(root, 'Teachers_List'), 'Teacher').map(node => ({name: trimmed(node, 'Name'), longName: trimmed(node, 'Long_Name'), code: trimmed(node, 'Code'), target: trimmed(node, 'Target_Number_of_Hours')}));
    const subjects = children(child(root, 'Subjects_List'), 'Subject').map(node => ({name: trimmed(node, 'Name'), longName: trimmed(node, 'Long_Name'), code: trimmed(node, 'Code')}));
    const students = children(child(root, 'Students_List'), 'Year').map(year => ({
      name: trimmed(year, 'Name'),
      groups: children(year, 'Group').map(group => ({name: trimmed(group, 'Name'), subgroups: children(group, 'Subgroup').map(subgroup => trimmed(subgroup, 'Name'))}))
    }));
    const activities = new Map(children(child(root, 'Activities_List'), 'Activity').map(node => [trimmed(node, 'Id'), {
      teachers: children(node, 'Teacher').map(item => item.textContent.trim()),
      subject: trimmed(node, 'Subject'),
      students: children(node, 'Students').map(item => item.textContent.trim()),
      tags: children(node, 'Activity_Tag').map(item => item.textContent.trim())
    }]));
    const unavailable = children(child(root, 'Time_Constraints_List'), 'ConstraintTeacherNotAvailableTimes')
      .filter(node => trimmed(node, 'Active') !== 'false')
      .flatMap(node => children(node, 'Not_Available_Time').map(slot => ({teacher: trimmed(node, 'Teacher'), day: trimmed(slot, 'Day'), hour: trimmed(slot, 'Hour'), weight: trimmed(node, 'Weight_Percentage')})));
    return {days, hours, teachers, subjects, students, activities, unavailable};
  }

  // Ανάλυση της εισαγωγής ωρολογίου από FET (πρώτη φάση· δεν αλλάζει τίποτα).
  //   input: {csvText, csvName, fetText, fetName, staff, classes, classLimit, teachingHours, replacing (το
  //           πρόγραμμα που θα αντικατασταθεί, αν υπάρχει)}. classes: τα Τμήματα του έτους, μαζί με όσα δεν
  //           έχουν αποθηκευτεί ακόμη· classLimit: το όριο πλήθους τμημάτων.
  // → {ok, errors, warnings, info, unmatchedTeachers, counts, newClasses, …}. Με λάθη η εισαγωγή δεν γίνεται.
  //   Τμήματα: τα Groups του FET αντιστοιχίζονται με το SchoolClasses.resolver· όσα τμήματα Γενικής Παιδείας
  //   λείπουν δημιουργούνται (newClasses, με τελικά id, που τα αποθηκεύει η εφαρμογή μαζί με το πρόγραμμα)·
  //   ονόματα που δεν είναι τμήματα μπαίνουν στο otherStudents.
  //   unmatchedTeachers: εκπαιδευτικοί χωρίς αντιστοίχιση· ο χρήστης επιλέγει «Εισαγωγή χωρίς
  //   αντιστοίχιση» ή «Να μην εισαχθούν» (buildFetProgram, options.unmatched 'keep' ή 'drop').
  function analyzeFetImport(input = {}) {
    const result = {ok: false, errors: [], warnings: [], info: [], unmatchedTeachers: [], counts: {}, newClasses: [], csvName: input.csvName || '', fetName: input.fetName || ''};
    const stop = message => { result.errors.push(message); return result; };
    const staff = input.staff || [];
    if (!staff.length) return stop('Δεν έχει συμπληρωθεί το Προσωπικό του σχολικού έτους. Συμπλήρωσέ το πρώτα στο «Προσωπικό».');
    let hours;
    try { hours = timedHours(input.teachingHours); } catch (error) { return stop(error.message); }
    const hourByName = new Map(hours.map(item => [item.name, item]));

    // CSV ωρολογίου
    const table = parse(input.csvText);
    const header = (table[0] || []).map(value => value.trim());
    const columns = Object.fromEntries(Object.entries(CSV_COLUMNS).map(([key, name]) => [key, header.indexOf(name)]));
    const missing = Object.entries(CSV_COLUMNS).filter(([key]) => key !== 'room' && columns[key] < 0).map(([, name]) => quoted(name));
    if (!header.length || missing.length) return stop('Το αρχείο CSV δεν είναι ωρολόγιο του FET: λείπουν οι στήλες ' + (missing.join(', ') || 'του ωρολογίου') + '. Χρησιμοποίησε το «…_timetable.csv» (ή «…_activities.csv» με ημέρες και ώρες) που γράφει το FET.');
    const rows = table.slice(1).map((row, index) => ({line: index + 2, get: key => columns[key] < 0 ? '' : (row[columns[key]] || '').trim()}));
    if (!rows.length) return stop('Το CSV δεν έχει δραστηριότητες. Έλεγξε ότι το FET ολοκλήρωσε τη δημιουργία προγράμματος και ότι επέλεξες το σωστό αρχείο.');

    // .fet
    let fet;
    try { fet = readFetFile(input.fetText); } catch (error) { return stop(error.message); }

    // Έλεγχος ωρών και ημερών
    const missingFetHours = fet.hours.filter(name => !hourByName.has(name));
    const missingCsvHours = unique(rows.map(row => row.get('hour'))).filter(name => !hourByName.has(name));
    if (missingFetHours.length || missingCsvHours.length) {
      return stop('Οι ώρες του FET δεν ταιριάζουν με τις Ώρες Διδασκαλίας. ' +
        (missingFetHours.length ? 'Ώρες του .fet που λείπουν από τις Ώρες Διδασκαλίας: ' + missingFetHours.map(quoted).join(', ') + '. ' : '') +
        (missingCsvHours.length ? 'Ώρες του CSV που λείπουν από τις Ώρες Διδασκαλίας: ' + missingCsvHours.map(quoted).join(', ') + '. ' : '') +
        'Διόρθωσε τις Ώρες Διδασκαλίας ή το FET και ξαναδοκίμασε.');
    }
    const dayNumber = name => {
      let index = weekdayIndex(name);
      if (index < 0) { const day = fet.days.find(item => item.name === name); if (day) index = weekdayIndex(day.longName); }
      return index < 0 ? 0 : index + 1;
    };
    const badDays = unique([...fet.days.map(day => day.name), ...rows.map(row => row.get('day'))]).filter(name => !dayNumber(name));
    if (badDays.length) return stop((badDays.length === 1 ? 'Η ημέρα ' + quoted(badDays[0]) + ' δεν αντιστοιχεί' : 'Οι ημέρες ' + badDays.map(quoted).join(', ') + ' δεν αντιστοιχούν') + ' σε Δευτέρα–Παρασκευή. Διόρθωσε τα ονόματα των ημερών στο FET ή στο CSV.');
    const usedDays = new Map();
    for (const day of fet.days) {
      const number = dayNumber(day.name);
      if (usedDays.has(number)) return stop('Οι ημέρες ' + quoted(usedDays.get(number)) + ' και ' + quoted(day.name) + ' του FET αντιστοιχούν και οι δύο στην ' + DAY_LABELS[number - 1] + '. Διόρθωσε τα ονόματα των ημερών στο FET.');
      usedDays.set(number, day.name);
    }

    // Δραστηριότητες (μία γραμμή του CSV ανά ώρα)
    const activities = new Map();
    for (const row of rows) {
      const id = row.get('id');
      if (!id) return stop('Η γραμμή ' + row.line + ' του CSV δεν έχει «Activity Id».');
      const hour = hourByName.get(row.get('hour'));
      if (!activities.has(id)) activities.set(id, {fetId: id, subject: row.get('subject'), teachers: tagsOf(row.get('teachers')), studentsSets: row.get('students'), csvTags: tagsOf(row.get('tags')), room: row.get('room'), times: []});
      activities.get(id).times.push({day: dayNumber(row.get('day')), start: hour.start, end: hour.end});
    }
    for (const activity of activities.values()) activity.times.sort((a, b) => a.day - b.day || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    // CSV και .fet
    const notInFet = [...activities.values()].filter(activity => !fet.activities.has(activity.fetId));
    const fetTeacherNames = new Set(fet.teachers.map(teacher => teacher.name));
    const teacherNames = unique([...activities.values()].flatMap(activity => activity.teachers));
    const teachersNotInFet = teacherNames.filter(name => !fetTeacherNames.has(name));
    if (notInFet.length) result.info.push(notInFet.length + ' δραστηριότητες του CSV δεν υπάρχουν στο .fet (Activity Id ' + notInFet.map(activity => activity.fetId).join(', ') + '). Εισάγονται κανονικά, χωρίς τα στοιχεία του .fet.');
    if (teachersNotInFet.length) result.info.push('Εκπαιδευτικοί του CSV που δεν υπάρχουν στο .fet: ' + teachersNotInFet.map(quoted).join(', ') + '. Δεν θα έχουν κωδικό ούτε μη διαθεσιμότητες.');
    const different = [...activities.values()].filter(activity => {
      const original = fet.activities.get(activity.fetId);
      return original && (original.subject !== activity.subject || original.teachers.join('+') !== activity.teachers.join('+') || original.students.join('+') !== activity.studentsSets);
    });
    if (different.length) result.warnings.push(different.length + ' δραστηριότητες έχουν διαφορετικό μάθημα, εκπαιδευτικούς ή μαθητές στο CSV και στο .fet (π.χ. Activity Id ' + different.slice(0, 5).map(activity => activity.fetId).join(', ') + '). Έλεγξε ότι το CSV βγήκε από αυτό το .fet. Στο πρόγραμμα μπαίνουν τα στοιχεία του CSV.');

    // Εκπαιδευτικοί: πρώτα με τον κωδικό, μετά με το σύντομο όνομα
    const byCode = new Map(staff.filter(person => person.code).map(person => [compareKey(person.code), person]));
    const byShortName = new Map(staff.filter(person => person.shortName).map(person => [compareKey(person.shortName), person]));
    const fetTeacher = new Map(fet.teachers.map(teacher => [teacher.name, teacher]));
    const teacherMatch = new Map();
    for (const name of teacherNames) {
      const code = fetTeacher.get(name)?.code || '';
      const codeMatch = code ? byCode.get(compareKey(code)) : null, nameMatch = byShortName.get(compareKey(name));
      if (codeMatch && nameMatch && codeMatch.id !== nameMatch.id) result.warnings.push('Ο κωδικός ' + quoted(code) + ' του ' + quoted(name) + ' ανήκει στον/στην ' + quoted(codeMatch.shortName) + ' του Προσωπικού, ενώ το σύντομο όνομα ανήκει στον/στην ' + quoted(nameMatch.shortName) + '. Κρατήθηκε η αντιστοίχιση με τον κωδικό.');
      const person = codeMatch || nameMatch || null;
      teacherMatch.set(name, person ? person.id : null);
      if (!person) result.unmatchedTeachers.push(name);
    }
    if (result.unmatchedTeachers.length) result.warnings.push('Εκπαιδευτικοί χωρίς αντιστοίχιση στο Προσωπικό: ' + result.unmatchedTeachers.map(quoted).join(', ') + '. Μπορούν να εισαχθούν χωρίς αντιστοίχιση ή να μην εισαχθούν. Για αντιστοίχιση, διόρθωσε τον κωδικό ή το σύντομο όνομα στο Προσωπικό ή στο FET.');

    // Τμήματα: μόνο όσα εμφανίζονται στις δραστηριότητες.
    const resolver = classResolver(input.classes, {limit: input.classLimit});
    const hierarchy = studentsIndex(fet.students);
    for (const activity of activities.values()) activity.students = expandStudents(activity.studentsSets, hierarchy, resolver);
    if (resolver.overLimit.length) return stop('Η εισαγωγή θα δημιουργούσε τα τμήματα ' + resolver.overLimit.join(', ') + ', πάνω από το όριο των ' + input.classLimit + ' τμημάτων του σχολικού έτους. Αφαίρεσε τμήματα που δεν χρειάζονται στα «Τμήματα» ή διόρθωσε το FET.');
    const unknownSets = unique([...activities.values()].flatMap(activity => activity.students.unknown));
    if (unknownSets.length) result.info.push('Σύνολα μαθητών του CSV που δεν υπάρχουν στο .fet: ' + unknownSets.map(quoted).join(', ') + '.');
    const others = unique([...activities.values()].flatMap(activity => activity.students.otherStudents));
    if (others.length) result.info.push('Ομάδες μαθητών του FET που δεν είναι τμήματα: ' + others.map(quoted).join(', ') + '. Μένουν στις δραστηριότητες με το όνομά τους, χωρίς τμήμα. Ένα τμήμα που δεν είναι Γενικής Παιδείας (π.χ. «Τμήμα Ένταξης») αντιστοιχίζεται όταν υπάρχει με το ίδιο όνομα στα «Τμήματα».');
    result.newClasses = clone(sortClasses(resolver.newClasses));
    if (result.newClasses.length) result.warnings.push('Θα δημιουργηθούν τα τμήματα: ' + result.newClasses.map(item => item.name).join(', ') + '.');

    if (input.replacing?.source?.modifiedAfterImport?.replacements?.length) {
      result.warnings.push('Το πρόγραμμα που αντικαθίσταται είχε τροποποιηθεί μετά την εισαγωγή με αντικαταστάσεις εκπαιδευτικών (' + input.replacing.source.modifiedAfterImport.replacements.map(item => (item.fromName || '?') + ' → ' + (item.toName || '?')).join(', ') + '). Βεβαιώσου ότι οι αντικαταστάσεις έχουν περάσει και στο FET.');
    }

    result.counts = {activities: activities.size, rows: rows.length, teachers: teacherNames.length, matched: teacherNames.length - result.unmatchedTeachers.length};
    result.ok = true;
    // Για τη δεύτερη φάση (buildFetProgram). Δεν προορίζονται για εμφάνιση.
    Object.defineProperty(result, 'plan', {enumerable: false, value: {activities, fet, teacherMatch, hours, dayNumber}});
    return result;
  }

  // Κατασκευή του προγράμματος από την ανάλυση (δεύτερη φάση). Τα νέα τμήματα της ανάλυσης
  // (analysis.newClasses) τα αποθηκεύει η εφαρμογή μαζί με το πρόγραμμα.
  //   options: {unmatched:'keep'|'drop', kind ('school'), name, periodId (ή null για προσχέδιο), now}.
  function buildFetProgram(analysis, options = {}) {
    if (!analysis?.ok || !analysis.plan) throw Error('Η εισαγωγή δεν μπορεί να γίνει: ' + (analysis?.errors?.[0] || 'δεν έγινε ανάλυση.'));
    const {activities, fet, teacherMatch, dayNumber} = analysis.plan;
    const keepUnmatched = options.unmatched !== 'drop', at = options.now || nowIso();
    const hourByName = new Map(analysis.plan.hours.map(item => [item.name, item]));
    const programActivities = [], sourceActivities = {};
    for (const activity of activities.values()) {
      const id = 'fet-' + activity.fetId, students = activity.students;
      const matched = activity.teachers.map(name => teacherMatch.get(name)).filter(Boolean);
      const unmatched = keepUnmatched ? activity.teachers.filter(name => !teacherMatch.get(name)) : [];
      programActivities.push({id, subject: activity.subject, staff: unique(matched), unmatched: unique(unmatched), classes: [...students.classes], subsets: [...students.subsets], otherStudents: [...students.otherStudents], room: activity.room, times: clone(activity.times)});
      sourceActivities[id] = {fetId: activity.fetId, tags: fet.activities.get(activity.fetId)?.tags || activity.csvTags, students: activity.studentsSets};
    }
    const unavailable = fet.unavailable.map(item => {
      const hour = hourByName.get(item.hour), day = dayNumber(item.day);
      return hour && day ? {teacher: item.teacher, day, hour: item.hour, start: hour.start, end: hour.end, weight: item.weight} : null;
    }).filter(Boolean);
    return {
      id: options.id || uid(), formatVersion: 2, kind: options.kind || 'school', periodId: options.periodId ?? null,
      name: options.name || '', createdAt: at, updatedAt: at,
      activities: programActivities,
      source: {
        type: 'fet', csvName: analysis.csvName, fetName: analysis.fetName, importedAt: at,
        activities: sourceActivities,
        students: fet.students,
        teachers: fet.teachers.map(teacher => ({...teacher, staffId: teacherMatch.get(teacher.name) ?? null})),
        unavailable, subjects: fet.subjects,
        modifiedAfterImport: null, oloimero: null
      }
    };
  }

  // ---- Εισαγωγείς ----
  // Ένας εισαγωγέας λέει πώς φτιάχνεται ένα πρόγραμμα ενός είδους από εξωτερικά αρχεία, σε δύο φάσεις.
  // Τον χρησιμοποιούν οι «Περίοδοι Προγραμμάτων» (προγράμματα περιόδων) και η εφαρμογή-κάτοχος του είδους,
  // με τον κοινό διάλογο schoolProgramImport του _ui.js. Τα αρχεία τα διαβάζει το host.
  //   id         μοναδικό μέσα στο είδος (π.χ. 'fet')
  //   label      η ενέργεια για τον χρήστη (π.χ. «Εισαγωγή από FET»)
  //   intro      τι αρχεία ζητά, για τον διάλογο
  //   files      [{key, label, description, accept:{mime:[καταλήξεις]}}]: τα αρχεία, με τη σειρά τους
  //   analyze(files, {staff, classes, classLimit, teachingHours, replacing})
  //              files: {key: {name, text}}· classes: τα Τμήματα του έτους, μαζί με όσα δεν έχουν αποθηκευτεί
  //              ακόμη· classLimit: το όριο πλήθους τμημάτων (από τα limits του context).
  //              → {ok, errors, warnings, info, unmatchedTeachers, newClasses, summary:[{value, label}]}.
  //              newClasses: τα τμήματα που θα δημιουργηθούν, με τελικά id· η εφαρμογή τα στέλνει στο host με
  //              την ίδια «Αποθήκευση» με το πρόγραμμα. Όταν υπάρχουν, η ανάλυση έχει και προειδοποίηση («Θα
  //              δημιουργηθούν τα τμήματα: …»), ώστε ο διάλογος εισαγωγής να ανοίγει πάντα.
  //   build(analysis, {unmatched:'keep'|'drop', kind, periodId, name, id, now}) → το πρόγραμμα
  function fetImporter() {
    return Object.freeze({
      id: 'fet',
      label: 'Εισαγωγή από FET',
      intro: 'Επίλεξε το CSV ωρολογίου («…_timetable.csv») και το αρχείο .fet από το οποίο βγήκε.',
      files: Object.freeze([
        Object.freeze({key: 'csv', label: 'CSV ωρολογίου', description: 'CSV ωρολογίου του FET', accept: Object.freeze({'text/csv': ['.csv']})}),
        Object.freeze({key: 'fet', label: 'Αρχείο .fet', description: 'Αρχείο FET', accept: Object.freeze({'application/xml': ['.fet']})})
      ]),
      analyze(files, options = {}) {
        const analysis = analyzeFetImport({csvText: files.csv?.text, csvName: files.csv?.name, fetText: files.fet?.text, fetName: files.fet?.name, staff: options.staff, classes: options.classes, classLimit: options.classLimit, teachingHours: options.teachingHours, replacing: options.replacing});
        if (analysis.ok) {
          const preview = buildFetProgram(analysis, {unmatched: 'keep'});
          analysis.summary = [
            {value: analysis.counts.activities, label: 'δραστηριότητες'},
            {value: analysis.counts.rows, label: 'ώρες στο πρόγραμμα'},
            {value: unique(preview.activities.flatMap(activity => activity.classes)).length, label: 'τμήματα'},
            {value: analysis.counts.matched + '/' + analysis.counts.teachers, label: 'εκπαιδευτικοί με αντιστοίχιση'}
          ];
          if (analysis.newClasses.length) analysis.summary.push({value: analysis.newClasses.length, label: 'νέα τμήματα'});
        }
        return analysis;
      },
      build: (analysis, options = {}) => buildFetProgram(analysis, options)
    });
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

  // ---- Πεδία εγγράφων (Documents Templater) ----
  // Τα πεδία από το κοινό αρχείο γράφονται στα πρότυπα με «@» στην αρχή: {{@Σχολείο}}, {{@Εκπ.Πρ.Δε.1}}.
  // Χωρίς «@» ένα πεδίο είναι πάντα χειροκίνητο. Ο κατάλογος γράφεται με «οικογένειες» πεδίων (στατικά, ώρες,
  // πλέγμα, σύνολα, μαθήματα), ώστε να προστίθενται εύκολα νέα. Ο τύπος κάθε πεδίου είναι γραμμένος εδώ·
  // το «:Integer» / «:Date» στο πρότυπο είναι προαιρετικό. Πρόγραμμα είναι μόνο το Ωρολόγιο (school) της περιόδου·
  // από το σχέδιο Ολοημέρου (oloimero) της περιόδου παίρνεται μόνο η θέση των δραστηριοτήτων (Τμήματα Ολοημέρου).
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
  // → {schoolName, year, period, program, design, slots, rows, slotError, subjects, info, …}. Το πρόγραμμα είναι το
  //   Ωρολόγιο (school) της περιόδου· design το σχέδιο Ολοημέρου (oloimero) της περιόδου, μόνο για τις θέσεις.
  function docContext(input = {}, options = {}) {
    const staff = (input.staff || []).filter(isObject), classes = (input.classes || []).filter(isObject);
    const year = String(input.year || input.school?.year || '');
    const period = (input.periods || []).find(item => item?.id === options.periodId) || null;
    const program = period ? (input.programs || []).find(item => item?.kind === 'school' && item.periodId === period.id) || null : null;
    const design = period ? (input.programs || []).find(item => item?.kind === 'oloimero' && item.periodId === period.id) || null : null;
    let slots = [], rows = [], slotError = '';
    try { ({slots, rows} = docSlots(input.teachingHours)); } catch (error) { slotError = error.message; }
    const subjects = (program?.source?.subjects || []).filter(item => String(item?.code ?? '').trim())
      .map(item => ({code: String(item.code).trim(), name: String(item.name ?? '').trim(), longName: String(item.longName ?? '').trim()}));
    const codes = program ? new Map(subjects.map(item => [compareKey(item.code), item.code])) : null;
    return {
      schoolName: docPlain(input.school?.name), year, staff, classes, sortedStaff: sortStaff(staff), staffById: new Map(staff.map(person => [person.id, person])),
      classesById: classesById(classes), studentCounts: isObject(input.studentCounts) ? input.studentCounts : {},
      period, program, design, slots, rows, slotError, subjects, today: options.today || today(),
      info: {slotKeys: slots.length ? new Set(slots.map(slot => slot.key)) : null, codes}
    };
  }

  // ---- Τιμές ----
  const slotOverlaps = (time, slot) => time.start < slot.end && slot.start < time.end;
  function docTargetData(c, target) {
    const activities = c.program?.activities || [];
    const list = target?.type === 'staff' ? activities.filter(activity => (activity.staff || []).includes(target.id))
      : target?.type === 'class' ? activities.filter(activity => (activity.classes || []).includes(target.id)) : [];
    return {type: target?.type, list};
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
  const docTeachers = (c, activity, short) => [...(activity.staff || []).map(id => { const person = c.staffById.get(id); return person ? String((short ? person.shortName : person.name) || person.shortName || person.name || '') : ''; }), ...(activity.unmatched || [])];

  function docGridValue(c, data, spec) {
    const slot = c.slots.find(item => item.key === spec.slot);
    if (!slot) return '';
    const cell = data.list.filter(activity => (activity.times || []).some(time => time.day === spec.day.day && slotOverlaps(time, slot)));
    const students = activity => studentsText(activity, {classes: c.classes});
    const subject = activity => String(activity.subject ?? '').trim();
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
    let items = docTimes(data, data.list.filter(activity => keys.has(compareKey(activity.subject))));
    if (spec.day) items = items.filter(item => item.time.day === spec.day.day);
    items = docInZone(c, items, spec.zone);
    if (!spec.which) return String(items.length);
    return unique(docZoneSlots(c, spec.zone).filter(slot => items.some(item => slotOverlaps(item.time, slot))).map(slot => slot.key)).join('+');
  }

  // ---- Τμήματα Ολοημέρου ----
  // Οι θέσεις («Τμήμα 1, 2…» μιας ώρας) είναι οι θέσεις του σχεδίου Ολοημέρου της περιόδου (source.placements[id].slot)·
  // το περιεχόμενο είναι πάντα το Ωρολόγιο. Κάθε ώρα δραστηριότητας του Ωρολογίου που είναι ολόκληρη σε ώρα Ολοημέρου
  // παίρνει τη θέση της «ίδιας» ώρας του σχεδίου (sameKey, ο κανόνας της Εισαγωγής Ολοημέρου, ανά ώρα). Όσες δεν
  // έχουν ίδια (ή όλες, χωρίς σχέδιο) μπαίνουν στις πρώτες ελεύθερες θέσεις της ώρας, με τη σειρά των μαθητών τους
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
    for (const activity of c.program?.activities || []) {
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
      items.sort((a, b) => rank(a.activity) - rank(b.activity) || text(a.activity).localeCompare(text(b.activity), 'el') || String(a.activity.subject || '').localeCompare(String(b.activity.subject || ''), 'el'));
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
  // → {warnings:[κείμενο…], infos:[κείμενο…]}. warnings: δραστηριότητες που δεν βρέθηκαν στο σχέδιο και μπήκαν σε
  //   ελεύθερη θέση, και τμήματα του Ωρολογίου πέρα από το μεγαλύτερο Τμ του προτύπου για την ίδια ημέρα και ώρα·
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
      return quoted(activity.subject || '—') + (parts.length ? ' (' + parts.join(' · ') + ')' : '');
    };
    const byPlace = (a, b) => a.day - b.day || (slotIndex.get(a.key) ?? 0) - (slotIndex.get(b.key) ?? 0);
    const moved = layout.moved.map(item => ({...item, key: item.slot.key})).filter(item => limits.has(item.day + '|' + item.key)).sort((a, b) => byPlace(a, b) || a.number - b.number);
    for (const item of moved) out.warnings.push('Ολοήμερο, ' + where(item.day, item.key) + ': η δραστηριότητα ' + describe(item.activity) + ' δεν βρέθηκε στο σχέδιο Ολοημέρου ' + quoted(c.design.name || '') + ' και μπήκε στο Τμήμα ' + item.number + '.');
    const places = [...limits.keys()].map(key => { const [day, slot] = key.split('|'); return {day: Number(day), key: slot}; }).sort(byPlace);
    for (const place of places) {
      const limit = limits.get(place.day + '|' + place.key), cell = layout.cells.get(place.day + '|' + place.key);
      const over = cell ? [...cell.keys()].filter(number => number > limit).sort((a, b) => a - b) : [];
      if (over.length) out.warnings.push('Ολοήμερο, ' + where(place.day, place.key) + ': το Ωρολόγιο έχει ' + (over.length === 1 ? 'και το Τμήμα ' + over[0] : 'και τα Τμήματα ' + over.join(', ')) + ', αλλά το πρότυπο έχει πεδία έως το Τμ' + limit + '· ' + (over.length === 1 ? 'δεν γράφεται' : 'δεν γράφονται') + ' στο έγγραφο.');
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
        out.set(name, docJoin(data.list.filter(activity => keys.has(compareKey(activity.subject)) && inZone(activity)).flatMap(activity => docTeachers(c, activity, false)), ', '));
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

  window.SchoolTags = Object.freeze({
    TYPES: TAG_TYPES, COLOR_KEYS: TAG_COLOR_KEYS, DEFAULT_COLORS: TAG_DEFAULT_COLORS, NEW_COLOR: TAG_NEW_COLOR,
    colors: tagColors, resolve: resolveTag, sort: sortTags, same: sameTag, nameKey: tagNameKey, clean: cleanTagRefs,
    validColor: tagColorValid, staffLabel: staffTagLabel, studentLabel: studentTagLabel
  });
  window.SchoolHtml = Object.freeze({sanitize: sanitizeHtml, hasText: htmlHasText});
  window.SchoolCsv =Object.freeze({parse, quote, detectDelimiter, staffCsvRead, staffCsvUpdate, staffCsvSuggest});
  window.SchoolFet = Object.freeze({parse: parseFet, child, children, text});
  window.SchoolText = Object.freeze({withoutTones, weekdayIndex});
  window.SchoolDate = Object.freeze({valid: isoValid, format: formatDate, parse: parseDate, schoolYear: schoolYearRange, schoolYearTeachingEnd, inSchoolYear, today, weekday: isoWeekday});
  window.SchoolClasses = Object.freeze({
    isGeneral: isGeneralClass, key: classKey, sort: sortClasses, byId: classesById, nameOf: classNameOf,
    grades: classGrades, renameError: classRenameError, resolver: classResolver
  });
  window.SchoolTimetable = Object.freeze({
    kinds: KINDS, countsInHours, importers: importersOf, importer: importerOf, hourGroupKeys: HOUR_GROUPS, dayLabels: DAY_LABELS,
    STAY_MINUTES, EARLY_ARRIVAL_MINUTES,
    parseTimeRange, hourTimes, timedHours, hourGroups,
    periodEnd, periodAt, programAt, programsAt, periodWarnings,
    classSpelling, studentsIndex, expandStudents, studentsFromNames, studentsText, homeroomTeacher, isGeneralTeacher, sortStaff, sortStaffAlphabetically,
    conflicts, studentsClash, staffHours, unavailableTimes, availability, staffBusyAt, replaceStaff,
    analyzeOloimeroReplace, applyOloimeroReplace,
    OLOIMERO_CATEGORIES, OLOIMERO_MAX_SLOTS, oloimeroHours, oloimeroTeacherColor, oloimeroStudents,
    oloimeroRowsFromCsv, oloimeroRowsFromProgram, oloimeroCsvFromProgram, oloimeroCells, analyzeOloimeroImport, buildOloimeroProgram,
    analyzeFetImport, buildFetProgram
  });
  window.SchoolDocumentFields = Object.freeze({
    MARK: DOC_MARK, DAYS: DOC_DAYS, ZONES: DOC_ZONES, ROLE_LABELS: DOC_ROLE_LABELS, SERVICE_LABELS: DOC_SERVICE_LABELS,
    slots: docSlots, context: docContext, recognize: docRecognize, templateKind: docTemplateKind, values: docValues, oloimeroNotes: docOloimeroNotes,
    catalog: docCatalog, readyTable: docReadyTable, subjectTable: docSubjectTable, fileName: docFileName, uniqueNames: docUniqueNames
  });
  window.SchoolStudents = Object.freeze({
    parseCsv: parseStudentsCsv, studentKey, sameStudent, compare: compareStudents,
    classGrade, promotedClass, adymRequiredFrom, adymStatus
  });
})();
