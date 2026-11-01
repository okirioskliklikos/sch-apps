/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων
 * Έκδοση αρχείου: 0.12
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
 *   window.SchoolTimetable  προγράμματα (timetablesByYear): ώρες, περίοδοι, υπεύθυνοι τμημάτων,
 *                           εμφάνιση μαθητών, συγκρούσεις, ώρες ανά εκπαιδευτικό, διαθεσιμότητα,
 *                           αντικαταστάσεις, Εισαγωγή Ολοημέρου στο ωρολόγιο, εισαγωγείς ανά είδος
 *                           (από FET και από το CSV του Ολοήμερου Designer), εξαγωγή CSV του Ολοημέρου
 *                           για το FET, δάσκαλοι και σειρά του Προσωπικού, κανονική γραφή τμημάτων
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
  const compareKey = value => withoutTones(value).toUpperCase().replace(/\s+/g, '');

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
    support: Object.freeze({label: 'Ειδικό Βοηθητικό Προσωπικό', owner: null, ownerTitle: '', counts: true, importers: Object.freeze([])}),
    special: Object.freeze({label: 'Ειδική Αγωγή', owner: null, ownerTitle: '', counts: true, importers: Object.freeze([])})
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

  // ---- Τμήματα και μαθητές ----
  // Τα τμήματα του σχολικού έτους: όσα έχουν υπεύθυνο στο Προσωπικό, με τη γραφή του Προσωπικού.
  const homeroomClasses = staff => unique((staff || []).map(person => String(person.homeroomClass || '').trim()).filter(Boolean));

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

  // «Students Sets» του FET (π.χ. «Β1+Δ'», «Ε1-Γαλ+Ε2-Γαλ», «Α'-Στ'») → {classes, subsets, unknown}.
  //   Οι τάξεις αναπτύσσονται στα τμήματά τους και τα τμήματα παίρνουν τη γραφή του Προσωπικού
  //   (π.χ. «ΣΤ1» → «Στ1»). Υποσύνολα (subgroups) μπαίνουν στα subsets. Όταν υπάρχουν υποσύνολα και
  //   ολόκληρα τμήματα μαζί, για κάθε ολόκληρο τμήμα μπαίνουν στα subsets το όνομά του και τα υποσύνολά
  //   του, ώστε ο έλεγχος συγκρούσεων να μη χάνει την επικάλυψη στο ολόκληρο τμήμα.
  //   unknown: σύνολα που δεν υπάρχουν στην ιεραρχία (μένουν ως τμήματα με τη γραφή του αρχείου).
  function expandStudents(value, hierarchy, classes) {
    const {index, subgroupsOf} = hierarchy instanceof Map ? {index: hierarchy, subgroupsOf: new Map()} : (hierarchy?.index ? hierarchy : studentsIndex(hierarchy));
    const known = new Map((classes || []).map(name => [compareKey(name), name]));
    const spell = name => known.get(compareKey(name)) || name;
    const parts = String(value ?? '').split('+').map(part => part.trim()).filter(Boolean);
    const whole = [], subsets = [], unknown = [];
    for (const part of parts) {
      const entry = index.get(part);
      if (!entry) { unknown.push(part); whole.push(spell(part)); }
      else if (entry.type === 'subgroup') subsets.push({class: spell(entry.parent), subset: part});
      else whole.push(...entry.groups.map(spell));
    }
    const result = {classes: unique([...whole, ...subsets.map(item => item.class)]), subsets: [], unknown};
    if (subsets.length) {
      result.subsets = unique([...subsets.map(item => item.subset), ...unique(whole).flatMap(name => {
        const original = [...subgroupsOf.keys()].find(key => compareKey(key) === compareKey(name));
        return [name, ...(original ? subgroupsOf.get(original) : [])];
      })]);
    }
    return result;
  }

  // ---- Τάξεις και τμήματα του σχολείου ----
  // Οι τάξεις με τη σειρά τους. Ένα τμήμα του Προσωπικού είναι γράμματα τάξης και αριθμός («Α1», «Στ2»).
  const GRADES = Object.freeze(['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ']);
  const GRADE_LABELS = Object.freeze({Α: "Α'", Β: "Β'", Γ: "Γ'", Δ: "Δ'", Ε: "Ε'", ΣΤ: "Στ'"});
  // Αποστρόφοι που γράφονται μετά το γράμμα της τάξης («Β'», «Β΄», «Β’»).
  const gradeKey = value => compareKey(value).replace(/['΄’ʹ`´ʼ]/g, '');
  // «Α1» → {grade:'Α', number:1}· «Στ2» → {grade:'ΣΤ', number:2}· αλλιώς null.
  function classParts(name) {
    const match = /^(ΣΤ|[ΑΒΓΔΕ])(\d+)$/.exec(compareKey(name));
    return match ? {grade: match[1], number: Number(match[2])} : null;
  }
  // Η κανονική γραφή ενός τμήματος: «ΣΤ1», «στ1», «Στ 1» → «Στ1»· «α2», «Ά2» → «Α2». Χωρίς τόνους, κενά και
  // διάκριση πεζών–κεφαλαίων. Τιμή που δεν είναι γράμματα τάξης (Α–Στ) και αριθμός → ''.
  function classSpelling(name) {
    const parts = classParts(name);
    return parts ? (parts.grade === 'ΣΤ' ? 'Στ' : parts.grade) + parts.number : '';
  }
  // Τα τμήματα του σχολείου ανά τάξη, με τη σειρά τους: [{grade, classes:[…]}]. Μόνο τάξεις που υπάρχουν.
  function schoolGrades(classes) {
    const byGrade = new Map();
    for (const name of classes || []) {
      const parts = classParts(name);
      if (!parts) continue;
      if (!byGrade.has(parts.grade)) byGrade.set(parts.grade, []);
      byGrade.get(parts.grade).push({name, number: parts.number});
    }
    return GRADES.filter(grade => byGrade.has(grade)).map(grade => ({grade, classes: byGrade.get(grade).sort((a, b) => a.number - b.number).map(item => item.name)}));
  }

  // Ονόματα ομάδων μαθητών (π.χ. του Ολοήμερου Designer: «Α1», «Β'», «Α'-Στ'», «Ε1-Γαλ», ή «Β1+Δ'») →
  // {classes, subsets, unknown}, με τους κανόνες της εισαγωγής από FET, χωρίς ιεραρχία του FET:
  //   τμήμα με υπεύθυνο → classes· τάξη («Β'») → τα τμήματά της· εύρος τάξεων («Α'-Στ'») → τα τμήματα
  //   των τάξεων· υποσύνολο («Ε1-Γαλ»: τμήμα, «-», όνομα) → subsets, με το τμήμα του στα classes·
  //   οτιδήποτε άλλο → unknown, και μένει στα classes με τη γραφή του.
  //   Με υποσύνολα και ολόκληρα τμήματα μαζί, τα ολόκληρα τμήματα μπαίνουν και στα subsets.
  function studentsFromNames(value, classes) {
    const parts = (Array.isArray(value) ? value : String(value ?? '').split('+')).map(part => String(part).trim()).filter(Boolean);
    const known = new Map((classes || []).map(name => [compareKey(name), name]));
    const grades = schoolGrades(classes), gradeOrder = grades.map(item => item.grade);
    const gradeClasses = grade => grades.find(item => item.grade === grade)?.classes || [];
    const byLength = [...known.keys()].sort((a, b) => b.length - a.length);
    const whole = [], subsets = [], unknown = [];
    for (const part of parts) {
      const key = compareKey(part), plain = gradeKey(part);
      if (known.has(key)) { whole.push(known.get(key)); continue; }
      const grade = /^(ΣΤ|[ΑΒΓΔΕ])$/.exec(plain);
      if (grade && gradeOrder.includes(grade[1])) { whole.push(...gradeClasses(grade[1])); continue; }
      const range = /^(ΣΤ|[ΑΒΓΔΕ])[-–—](ΣΤ|[ΑΒΓΔΕ])$/.exec(plain);
      if (range && gradeOrder.includes(range[1]) && gradeOrder.includes(range[2])) {
        const from = GRADES.indexOf(range[1]), to = GRADES.indexOf(range[2]);
        whole.push(...gradeOrder.filter(item => GRADES.indexOf(item) >= Math.min(from, to) && GRADES.indexOf(item) <= Math.max(from, to)).flatMap(gradeClasses));
        continue;
      }
      const parent = byLength.find(name => key.length > name.length + 1 && key.startsWith(name) && /[-–_]/.test(key[name.length]));
      if (parent) { subsets.push({class: known.get(parent), subset: part}); continue; }
      unknown.push(part); whole.push(part);
    }
    const result = {classes: unique([...whole, ...subsets.map(item => item.class)]), subsets: [], unknown: unique(unknown)};
    if (subsets.length) result.subsets = unique([...subsets.map(item => item.subset), ...unique(whole)]);
    return result;
  }

  // ---- Εμφάνιση μαθητών ----
  // Το κείμενο που δείχνουν όλες οι εφαρμογές για τους μαθητές μιας δραστηριότητας. Υπολογίζεται από τα
  // classes / subsets και τα τμήματα του Προσωπικού (ctx: {staff} ή {classes}) και δεν αποθηκεύεται.
  //   ένα τμήμα ή ένα υποσύνολο → όπως είναι («Α1», «Ε1-Γαλ»)·
  //   ολόκληρη τάξη → «Β'» (τάξη με ένα μόνο τμήμα → το τμήμα)· μερική τάξη → τα τμήματα («Β1»)·
  //   τρεις ή περισσότερες συνεχόμενες ολόκληρες τάξεις → εύρος («Α'-Γ'», «Α'-Στ'»)· δύο, ή μη
  //   συνεχόμενες, χωριστά («Α', Β'»)· μετά τα υποσύνολα, και στο τέλος άλλα ονόματα όπως είναι.
  //   Διαχωριστικό «, ».
  // Τα υποσύνολα που προστέθηκαν μόνο για τον έλεγχο συγκρούσεων (το όνομα ενός ολόκληρου τμήματος και
  // τα υποσύνολά του) δεν εμφανίζονται.
  function studentsText(activity, ctx = {}) {
    const classes = unique((activity?.classes || []).map(name => String(name).trim()).filter(Boolean));
    const subsets = unique((activity?.subsets || []).map(name => String(name).trim()).filter(Boolean));
    if (!classes.length && !subsets.length) return '';
    const school = ctx.classes || homeroomClasses(ctx.staff);
    const spelled = new Map(school.map(name => [compareKey(name), name]));
    const subsetKeys = new Set(subsets.map(compareKey));
    const mixed = subsets.length > 0;
    // Ολόκληρα τμήματα: χωρίς υποσύνολα όλα· με υποσύνολα, όσα υπάρχουν και στα subsets.
    const whole = new Set(), unknown = [];
    for (const name of classes) {
      const key = compareKey(name);
      if (mixed && !subsetKeys.has(key)) continue;
      if (spelled.has(key) && classParts(name)) whole.add(spelled.get(key));
      else unknown.push(name);
    }
    const grades = schoolGrades(school), tokens = [];
    for (const {grade, classes: list} of grades) {
      const present = list.filter(name => whole.has(name));
      if (!present.length) continue;
      if (present.length === list.length) tokens.push({grade, full: true, label: list.length === 1 ? list[0] : GRADE_LABELS[grade]});
      else present.forEach(name => tokens.push({grade, full: false, label: name}));
    }
    // Εύρος: τρεις ή περισσότερες ολόκληρες τάξεις, συνεχόμενες στις τάξεις του σχολείου.
    const order = grades.map(item => item.grade), pieces = [];
    for (let i = 0; i < tokens.length;) {
      let j = i;
      while (tokens[i].full && j + 1 < tokens.length && tokens[j + 1].full && order.indexOf(tokens[j + 1].grade) === order.indexOf(tokens[j].grade) + 1) j++;
      if (tokens[i].full && j - i >= 2) { pieces.push(GRADE_LABELS[tokens[i].grade] + '-' + GRADE_LABELS[tokens[j].grade]); i = j + 1; }
      else { pieces.push(tokens[i].label); i++; }
    }
    const wholeKeys = [...whole].map(compareKey);
    const shownSubsets = subsets.filter(name => {
      const key = compareKey(name);
      return !classes.some(item => compareKey(item) === key) && !wholeKeys.some(prefix => key.startsWith(prefix) && key.length > prefix.length && /[-–_]/.test(key[prefix.length]));
    });
    return [...pieces, ...shownSubsets, ...unknown].join(', ');
  }

  // ---- Υπεύθυνος τμήματος μέσα σε πρόγραμμα ----
  // → {id} για εκπαιδευτικό του Προσωπικού, {name} για όνομα χωρίς αντιστοίχιση, ή null.
  //   1. ο υπεύθυνος του τμήματος στο Προσωπικό, αν εμφανίζεται στο πρόγραμμα,
  //   2. αλλιώς ο εκπαιδευτικός του προγράμματος που το σύντομο όνομά του ξεκινά με «[τμήμα]».
  function homeroomTeacher(program, className, staff) {
    const key = compareKey(className), activities = program?.activities || [];
    const ids = new Set(activities.flatMap(activity => activity.staff || []));
    const people = staff || [];
    const official = people.find(person => compareKey(person.homeroomClass) === key && ids.has(person.id));
    if (official) return {id: official.id};
    const prefix = compareKey('[' + className + ']');
    const byName = people.find(person => ids.has(person.id) && compareKey(person.shortName).startsWith(prefix));
    if (byName) return {id: byName.id};
    const name = unique(activities.flatMap(activity => activity.unmatched || [])).find(item => compareKey(item).startsWith(prefix));
    return name ? {name} : null;
  }

  // ---- Συγκρούσεις ----
  const timesOverlap = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;
  // Συγκρούονται στους μαθητές; Κοινό τμήμα, εκτός αν και οι δύο έχουν υποσύνολα χωρίς κοινό στοιχείο.
  function studentsClash(a, b) {
    const common = (a.classes || []).filter(name => (b.classes || []).includes(name));
    if (!common.length) return [];
    if (a.subsets?.length && b.subsets?.length && !a.subsets.some(item => b.subsets.includes(item))) return [];
    return common;
  }
  // Συγκρούσεις μέσα σε ένα πρόγραμμα, ή σε πολλά μαζί (programs: πίνακας).
  // → [{type:'staff'|'unmatched'|'class', who, day, start, end, a, b}], όπου a, b οι δραστηριότητες.
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
      for (const name of studentsClash(x.activity, y.activity)) result.push({type: 'class', who: name, ...base});
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
  const sameKey = (activity, staff) => JSON.stringify([
    String(activity.subject || '').trim(), [...(activity.staff || [])].sort(), [...(activity.unmatched || [])].sort(),
    [...(activity.classes || [])].sort(), studentsText(activity, {staff}),
    (activity.times || []).map(time => time.day + ' ' + time.start + '-' + time.end).sort()
  ]);

  // Ανάλυση (δεν αλλάζει τίποτα).
  //   program: το ωρολόγιο· design: το σχέδιο του .data· options: {staff, teachingHours, designName}.
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
    const staff = options.staff || [], staffById = new Map(staff.map(person => [person.id, person]));
    // Μια ώρα είναι «ώρα Ολοημέρου» όταν χωρά ολόκληρη σε μια ώρα Ολοημέρου των Ωρών Διδασκαλίας.
    const inside = time => hours.some(hour => hour.start <= time.start && time.end <= hour.end);
    const touches = time => hours.some(hour => time.start < hour.end && hour.start < time.end);
    const describe = activity => {
      const people = [...(activity.staff || []).map(id => staffById.get(id)?.shortName || '?'), ...(activity.unmatched || [])].join(', ');
      const parts = [studentsText(activity, {staff}), people].filter(Boolean);
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
        classes: [...(activity.classes || [])], subsets: [...(activity.subsets || [])], room: String(activity.room || ''),
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
      const key = sameKey(activity, staff);
      if (!waiting.has(key)) waiting.set(key, []);
      waiting.get(key).push(activity.id);
    }
    for (const activity of incoming) {
      const match = waiting.get(sameKey(activity, staff));
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
  //   version: 1, csvName, importedAt (όταν προήλθε από εισαγωγή),
  //   design:   {hours:[{hourId, count, exceptionsEnabled, dayCounts:[Δε, Τρ, Τε, Πε, Πα]}]}: πόσα κελιά έχει
  //             κάθε ώρα (Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο) ανά ημέρα,
  //   teachers: [{staffId|null, name, color, availableHours}]: οι εκπαιδευτικοί της αριστερής μπάρας
  //             (name: το σύντομο όνομα· για όσους δεν αντιστοιχίστηκαν, το όνομα του αρχείου),
  //   subjects / departments: [{id, name}], unions: [{id, name, departmentIds}],
  //   styles:   {teacher, subject, department, union}: {fontSize, bold, italic},
  //   placements: {[activityId]: {hourId, day (1–5), slot, students:[{type:'department'|'union', id}]}}:
  //             η θέση κάθε δραστηριότητας στον πίνακα και τα τμήματα/συνενώσεις του κελιού,
  //   pending:  [{hourId, day, slot, staffId|null, name, subjectId|null, students}]: τα ελλιπή κελιά (δεν
  //             είναι δραστηριότητες, δεν μετρούν και δεν βγαίνουν στο CSV).
  // Οι εκπαιδευτικοί και το μάθημα κάθε δραστηριότητας διαβάζονται από τη δραστηριότητα (staff, unmatched,
  // subject), όχι από το source, ώστε να ισχύουν οι αλλαγές του host σε διαγραφή εκπαιδευτικού.
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

  // Τμήματα και συνενώσεις ενός κελιού → {text, classes, subsets, unknown}. text: τα ονόματα ενωμένα με «+»,
  // όπως τα γράφει η στήλη «Students Sets» του CSV για το FET.
  //   Μια συνένωση αναλύεται με το όνομά της, όπως θα το διαβάσει το FET (π.χ. «Α'-Στ'», «Β1+Δ'»)· αν το
  //   όνομα δεν είναι τμήματα, τάξεις ή υποσύνολα (π.χ. «Συνένωση Α»), αναλύεται στα τμήματά της.
  //   lists: {departments, unions} (του source)· classes: τα τμήματα του σχολείου (homeroomClasses).
  function oloimeroStudents(items, lists, classes) {
    const departments = new Map((lists?.departments || []).map(item => [item.id, item])), unions = new Map((lists?.unions || []).map(item => [item.id, item]));
    const records = (items || []).map(item => item?.type === 'union' ? {item, record: unions.get(item.id)} : {item, record: departments.get(item?.id)}).filter(entry => entry.record?.name);
    const names = records.flatMap(({item, record}) => {
      if (item.type !== 'union' || !studentsFromNames(record.name, classes).unknown.length) return [record.name];
      return (record.departmentIds || []).map(id => departments.get(id)?.name).filter(Boolean);
    });
    return {text: records.map(entry => entry.record.name).join('+'), ...studentsFromNames(names, classes)};
  }

  // Οι γραμμές ενός σχεδίου, με τη σειρά του CSV για το FET:
  //   Πρωινή Ζώνη (κατά ημέρα), μετά για κάθε ημέρα Γεύμα και Ολοήμερο (κατά ώρα και θέση), μετά Διευρυμένο.
  // Με αυτή τη σειρά δίνει το FET τα Activity Id στις δραστηριότητες του CSV.
  //   ctx: {staff, teachingHours}. → {rows, sorted, incomplete}: rows με τη σειρά του CSV, sorted κατά
  //   ημέρα και ώρα· incomplete: δραστηριότητες χωρίς εκπαιδευτικό, μάθημα, μαθητές ή ώρα του πίνακα.
  function oloimeroDesignRows(program, ctx = {}) {
    const hours = oloimeroHours(ctx.teachingHours);
    const hourIndex = new Map(hours.map((item, index) => [String(item.hour.id), index]));
    const source = program?.source?.type === 'oloimero-designer' ? program.source : {};
    const placements = isObject(source.placements) ? source.placements : {};
    const staffById = new Map((ctx.staff || []).map(person => [person.id, person]));
    const zoneTags = ctx.teachingHours?.tags || {}, dayTags = ctx.teachingHours?.dayTags || {};
    const items = [];
    let incomplete = 0;
    (program?.activities || []).forEach((activity, order) => {
      const place = isObject(placements[activity.id]) ? placements[activity.id] : null, time = activity.times?.[0];
      let hour = place ? hours.find(item => String(item.hour.id) === String(place.hourId)) : null;
      if (!hour && time) hour = hours.find(item => item.start === time.start && item.end === time.end);
      const day = Number(place?.day || time?.day) || 0;
      const students = place?.students?.length ? oloimeroStudents(place.students, source, []).text : (activity.classes || []).join('+');
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
  function oloimeroRowsFromProgram(program, ctx = {}) {
    return oloimeroDesignRows(program, ctx).rows.map((row, index) => ({line: index + 1, activityId: row.activityId, studentsSets: row.studentsSets, subject: row.subject, teachers: [...row.teachers], tags: [...row.tags]}));
  }

  // Εξαγωγή CSV για το FET από ένα σχέδιο (προσχέδιο ή σχέδιο περιόδου). Στη στήλη «Teachers» μπαίνει το
  // σύντομο όνομα του Προσωπικού, ή το αρχικό όνομα για όσους δεν αντιστοιχίστηκαν. Το αρχείο κρατά στο
  // τέλος, σε σχόλια που το FET αγνοεί, τα στοιχεία σχεδίασης (χρώματα, τμήματα, συνενώσεις, Σχεδιασμός),
  // ώστε μια νέα εισαγωγή του να δίνει τον ίδιο πίνακα.
  //   ctx: {staff, teachingHours, now}. → {text, exported, incomplete}.
  function oloimeroCsvFromProgram(program, ctx = {}) {
    const {rows, sorted, incomplete} = oloimeroDesignRows(program, ctx);
    const line = row => [quote(row.studentsSets), quote(row.subject), quote(row.teachers.join('+')), quote(row.tags.join('+')), 1, quote(''), '', '', '', quote('')].join(',');
    const lines = ['\uFEFF' + OLOIMERO_CSV_HEADER, '', '# Πρωινή Ζώνη #'];
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
    const metadata = {
      format: 'oloimero-designer-data-v3', exportedAt: ctx.now || nowIso(), name: program?.name || '',
      design: source.design || {hours: []},
      teachers: (source.teachers || []).map(teacher => ({...teacher, name: staffById.get(teacher.staffId)?.shortName || teacher.name})),
      subjects: source.subjects || [], departments: source.departments || [], unions: source.unions || [], styles: source.styles || {}
    };
    lines.push('', '', OLOIMERO_JSON_BEGIN, ...JSON.stringify(metadata, null, 2).split('\n').map(item => '# ' + item), OLOIMERO_JSON_END);
    return {text: lines.join('\n') + '\n', exported: rows.length, incomplete};
  }

  // Τα στοιχεία σχεδίασης που γράφει ο Designer στο τέλος του CSV (σε σχόλια). Διαβάζει τις μορφές v1, v2
  // (το παλιό αρχείο του Designer) και v3 (η εξαγωγή για το FET). → κανονικοποιημένα στοιχεία, {invalid:true}
  // όταν δεν διαβάζονται, ή null όταν το CSV δεν τα έχει.
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
    const named = value => list(value).map(item => ({id: text(item.id) || uid(), name: text(item.name)})).filter(item => item.name);
    const days = DAY_LABELS.slice(0, 5);
    const counts = (value, count) => Array.isArray(value) ? days.map((_, index) => clampCount(value[index] ?? count)) : days.map(day => clampCount(value?.[day] ?? count));
    let design = null;
    if (Array.isArray(payload.design?.hours)) design = list(payload.design.hours).map(item => ({ids: [text(item.hourId)], label: '', count: clampCount(item.count), exceptionsEnabled: !!item.exceptionsEnabled, dayCounts: counts(item.dayCounts, item.count)}));
    else if (Array.isArray(payload.state?.design?.periods)) design = list(payload.state.design.periods).map(item => ({ids: [text(item.sourceId), text(item.id)].filter(Boolean), label: text(item.label), count: clampCount(item.count), exceptionsEnabled: !!item.exceptionsEnabled, dayCounts: counts(item.dayCounts, item.count)}));
    const styles = Object.fromEntries(OLOIMERO_STYLE_KEYS.map(key => [key, designStyle(payload.styles?.[key] || payload.categoryStyles?.[key])]));
    return {
      format: text(payload.format), design, styles,
      teachers: list(payload.teachers).map(item => ({
        staffId: text(item.staffId) || null, code: text(item.staffCode), name: text(item.name),
        aliases: Array.isArray(item.aliases) ? item.aliases.map(text).filter(Boolean) : [],
        color: validColor(item.color) ? String(item.color).toLowerCase() : '', availableHours: Math.max(0, Math.floor(Number(item.availableHours) || 0))
      })).filter(item => item.name || item.staffId),
      subjects: named(payload.subjects), departments: named(payload.departments),
      unions: list(payload.unions).map(item => ({id: text(item.id) || uid(), name: text(item.name), departmentIds: Array.isArray(item.departmentIds) ? item.departmentIds.filter(id => typeof id === 'string') : []})).filter(item => item.name)
    };
  }

  // Ανάλυση της εισαγωγής ενός CSV του Ολοήμερου Designer (πρώτη φάση· δεν αλλάζει τίποτα).
  //   input: {csvText, csvName, staff, teachingHours}.
  //   Οι ημέρες και οι ώρες βγαίνουν από τις ετικέτες ημέρας (dayTags) και ώρας (fetTag) των Ωρών
  //   Διδασκαλίας. Αν το CSV έχει τα στοιχεία σχεδίασης του Designer, κρατιούνται χρώματα, τμήματα,
  //   συνενώσεις και Σχεδιασμός.
  // → {ok, errors, warnings, info, unmatchedTeachers, counts, …}. Με λάθη η εισαγωγή δεν γίνεται.
  function analyzeOloimeroImport(input = {}) {
    const result = {ok: false, errors: [], warnings: [], info: [], unmatchedTeachers: [], counts: {}, csvName: input.csvName || ''};
    const stop = message => { result.errors.push(message); return result; };
    const staff = input.staff || [];
    if (!staff.length) return stop('Δεν έχει συμπληρωθεί το Προσωπικό του σχολικού έτους. Συμπλήρωσέ το πρώτα στο «Προσωπικό».');
    let hours;
    try { hours = oloimeroHours(input.teachingHours); } catch (error) { return stop(error.message); }
    const sets = tagSets(input.teachingHours);
    if (!sets.dayTags.size || !hours.some(item => item.fetTag)) return stop('Οι Ώρες Διδασκαλίας δεν έχουν ετικέτες FET ημερών ή ωρών Ολοημέρου. Συμπλήρωσέ τες πρώτα στις «Ώρες Διδασκαλίας».');
    const hourByTag = new Map(hours.filter(item => item.fetTag).map(item => [item.fetTag, item]));
    let rows;
    try { rows = oloimeroRowsFromCsv(input.csvText); } catch (error) { return stop(error.message); }
    if (!rows.length) return stop('Το CSV του Ολοήμερου δεν έχει δραστηριότητες.');

    // Ημέρα και ώρα από τις ετικέτες· θέση στον πίνακα με τη σειρά των γραμμών.
    const placed = [], skipped = [], slots = new Map();
    for (const row of rows) {
      const day = sets.dayTags.get(row.tags.find(tag => sets.dayTags.has(tag))), hour = hourByTag.get(row.tags.find(tag => hourByTag.has(tag)));
      if (!day || !hour) { skipped.push(row); continue; }
      const key = hour.hour.id + '|' + day, slot = slots.get(key) || 0;
      slots.set(key, slot + 1);
      placed.push({row, day, hour, slot});
    }
    if (!placed.length) return stop('Καμία γραμμή του CSV δεν έχει ετικέτα ημέρας και ετικέτα ώρας Ολοημέρου των Ωρών Διδασκαλίας. Έλεγξε ότι το CSV βγήκε με τις τρέχουσες ετικέτες των Ωρών Διδασκαλίας.');
    if (skipped.length) result.warnings.push(skipped.length + ' γραμμές του CSV δεν έχουν ετικέτα ημέρας ή ώρας Ολοημέρου των Ωρών Διδασκαλίας και δεν εισάγονται (γραμμές ' + skipped.slice(0, 8).map(row => row.line).join(', ') + (skipped.length > 8 ? ', …' : '') + ').');

    const metadata = oloimeroMetadata(input.csvText);
    if (metadata?.invalid) result.info.push('Τα στοιχεία σχεδίασης στο τέλος του CSV δεν διαβάζονται. Εισάγονται μόνο οι δραστηριότητες, με προεπιλεγμένα χρώματα.');
    const meta = metadata && !metadata.invalid ? metadata : null;
    if (meta) result.info.push('Κρατήθηκαν και τα στοιχεία σχεδίασης του Designer που υπάρχουν στο CSV (χρώματα, τμήματα, συνενώσεις, Σχεδιασμός).');

    // Εκπαιδευτικοί: με το σύντομο όνομα, μετά με τον κωδικό.
    const byShortName = new Map(staff.filter(person => person.shortName).map(person => [compareKey(person.shortName), person]));
    const byCode = new Map(staff.filter(person => person.code).map(person => [compareKey(person.code), person]));
    const teacherNames = unique(placed.flatMap(item => item.row.teachers));
    const teacherMatch = new Map(teacherNames.map(name => [name, byShortName.get(compareKey(name)) || byCode.get(compareKey(name)) || null]));
    result.unmatchedTeachers = teacherNames.filter(name => !teacherMatch.get(name));
    if (result.unmatchedTeachers.length) result.warnings.push('Εκπαιδευτικοί χωρίς αντιστοίχιση στο Προσωπικό: ' + result.unmatchedTeachers.map(quoted).join(', ') + '. Μπορούν να εισαχθούν χωρίς αντιστοίχιση ή να μην εισαχθούν. Για αντιστοίχιση, διόρθωσε το σύντομο όνομα στο Προσωπικό ή στο CSV.');

    // Τμήματα και συνενώσεις του Designer, όπως τις έφτιαχνε και το άνοιγμα του CSV στον Designer.
    const departments = clone(meta?.departments || []), unions = clone(meta?.unions || []);
    const findName = (list, name) => list.find(item => compareKey(item.name) === compareKey(name));
    const addDepartment = name => findName(departments, name) || (departments.push({id: uid(), name}), departments[departments.length - 1]);
    const resolve = value => {
      const name = String(value || '').normalize('NFC').trim();
      if (!name) return [];
      const union = findName(unions, name);
      if (union) return [{type: 'union', id: union.id}];
      const department = findName(departments, name);
      if (department) return [{type: 'department', id: department.id}];
      const parts = name.split('+').map(part => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        const items = parts.map(part => { const u = findName(unions, part); if (u) return {type: 'union', id: u.id}; const d = findName(departments, part); return d ? {type: 'department', id: d.id} : null; });
        if (items.every(Boolean)) return items;
        const created = {id: uid(), name, departmentIds: parts.map(part => addDepartment(part).id)};
        unions.push(created);
        return [{type: 'union', id: created.id}];
      }
      return [{type: 'department', id: addDepartment(name).id}];
    };
    const classes = homeroomClasses(staff), unknown = [];
    for (const item of placed) {
      item.students = resolve(item.row.studentsSets);
      item.expanded = oloimeroStudents(item.students, {departments, unions}, classes);
      unknown.push(...item.expanded.unknown);
    }
    if (unique(unknown).length) result.info.push('Ομάδες μαθητών που δεν είναι τμήματα με υπεύθυνο στο Προσωπικό, τάξεις ή υποσύνολα τμημάτων: ' + unique(unknown).map(quoted).join(', ') + '. Μένουν στις δραστηριότητες με τη γραφή του αρχείου.');

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
      const saved = meta?.design?.find(entry => entry.ids.includes(id)) || meta?.design?.find(entry => entry.label && entry.label === item.name);
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

    result.counts = {activities: placed.length, rows: rows.length, teachers: teacherNames.length, matched: teacherNames.length - result.unmatchedTeachers.length, classes: unique(placed.flatMap(item => item.expanded.classes)).length};
    result.ok = true;
    // Για τη δεύτερη φάση (buildOloimeroProgram). Δεν προορίζονται για εμφάνιση.
    Object.defineProperty(result, 'plan', {enumerable: false, value: {placed, teacherMatch, meta, departments, unions, design, staff}});
    return result;
  }

  // Κατασκευή του σχεδίου από την ανάλυση (δεύτερη φάση).
  //   options: {unmatched:'keep'|'drop', kind ('oloimero'), name, periodId (ή null για προσχέδιο), id, now}.
  function buildOloimeroProgram(analysis, options = {}) {
    if (!analysis?.ok || !analysis.plan) throw Error('Η εισαγωγή δεν μπορεί να γίνει: ' + (analysis?.errors?.[0] || 'δεν έγινε ανάλυση.'));
    const {placed, teacherMatch, meta, departments, unions, design, staff} = analysis.plan;
    const keepUnmatched = options.unmatched !== 'drop', at = options.now || nowIso();
    const activities = [], placements = {};
    for (const item of placed) {
      const id = uid();
      const people = item.row.teachers.map(name => teacherMatch.get(name)).filter(Boolean);
      activities.push({
        id, subject: item.row.subject, staff: unique(people.map(person => person.id)),
        unmatched: keepUnmatched ? unique(item.row.teachers.filter(name => !teacherMatch.get(name))) : [],
        classes: [...item.expanded.classes], subsets: [...item.expanded.subsets], room: '',
        times: [{day: item.day, start: item.hour.start, end: item.hour.end}]
      });
      placements[id] = {hourId: String(item.hour.hour.id), day: item.day, slot: item.slot, students: clone(item.students)};
    }
    // Εκπαιδευτικοί της αριστερής μπάρας: όσοι είχε επιλέξει ο Designer και όσοι εμφανίζονται στις γραμμές.
    const savedFor = person => meta?.teachers.find(item => item.staffId === person.id)
      || meta?.teachers.find(item => item.code && compareKey(item.code) === compareKey(person.code))
      || meta?.teachers.find(item => [item.name, ...item.aliases].some(name => compareKey(name) === compareKey(person.shortName)));
    const chosen = new Map();
    for (const saved of meta?.teachers || []) {
      const person = staff.find(item => item.id === saved.staffId) || staff.find(item => saved.code && compareKey(item.code) === compareKey(saved.code)) || staff.find(item => [saved.name, ...saved.aliases].some(name => compareKey(name) === compareKey(item.shortName)));
      if (person) chosen.set(person.id, person);
    }
    for (const person of teacherMatch.values()) if (person) chosen.set(person.id, person);
    const teachers = sortStaff([...chosen.values()]).map(person => {
      const saved = savedFor(person);
      return {staffId: person.id, name: person.shortName, color: saved?.color || oloimeroTeacherColor(person), availableHours: saved?.availableHours || 0};
    });
    if (keepUnmatched) {
      for (const name of [...teacherMatch].filter(([, person]) => !person).map(([name]) => name).sort((a, b) => a.localeCompare(b, 'el', {numeric: true, sensitivity: 'base'}))) {
        const saved = meta?.teachers.find(item => [item.name, ...item.aliases].some(other => compareKey(other) === compareKey(name)));
        teachers.push({staffId: null, name, color: saved?.color || OLOIMERO_COLORS.other, availableHours: saved?.availableHours || 0});
      }
    }
    const subjects = clone(meta?.subjects || []);
    for (const name of unique(placed.map(item => item.row.subject).filter(Boolean))) if (!subjects.some(item => compareKey(item.name) === compareKey(name))) subjects.push({id: uid(), name});
    return {
      id: options.id || uid(), formatVersion: 1, kind: options.kind || 'oloimero', periodId: options.periodId ?? null,
      name: options.name || '', createdAt: at, updatedAt: at, activities,
      source: {
        type: 'oloimero-designer', version: 1, csvName: analysis.csvName, importedAt: at,
        design: clone(design), teachers, subjects, departments: clone(departments), unions: clone(unions),
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
  //   input: {csvText, csvName, fetText, fetName, staff, teachingHours, replacing (το πρόγραμμα που θα
  //           αντικατασταθεί, αν υπάρχει)}.
  // → {ok, errors, warnings, info, unmatchedTeachers, counts, …}. Με λάθη η εισαγωγή δεν γίνεται.
  //   unmatchedTeachers: εκπαιδευτικοί χωρίς αντιστοίχιση· ο χρήστης επιλέγει «Εισαγωγή χωρίς
  //   αντιστοίχιση» ή «Να μην εισαχθούν» (buildFetProgram, options.unmatched 'keep' ή 'drop').
  function analyzeFetImport(input = {}) {
    const result = {ok: false, errors: [], warnings: [], info: [], unmatchedTeachers: [], counts: {}, csvName: input.csvName || '', fetName: input.fetName || ''};
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

    // Τμήματα
    const classes = homeroomClasses(staff), classKeys = new Set(classes.map(compareKey));
    const hierarchy = studentsIndex(fet.students);
    const fetGroups = unique(fet.students.flatMap(year => year.groups.map(group => group.name)));
    const groupsWithout = fetGroups.filter(name => !classKeys.has(compareKey(name)));
    if (groupsWithout.length) result.info.push('Τμήματα του FET χωρίς υπεύθυνο στο Προσωπικό: ' + groupsWithout.map(quoted).join(', ') + '. Μένουν στις δραστηριότητες με τη γραφή του FET.');
    const unknownSets = unique([...activities.values()].flatMap(activity => expandStudents(activity.studentsSets, hierarchy, classes).unknown));
    if (unknownSets.length) result.info.push('Σύνολα μαθητών του CSV που δεν υπάρχουν στο .fet: ' + unknownSets.map(quoted).join(', ') + '. Μένουν ως τμήματα με τη γραφή του αρχείου.');

    if (input.replacing?.source?.modifiedAfterImport?.replacements?.length) {
      result.warnings.push('Το πρόγραμμα που αντικαθίσταται είχε τροποποιηθεί μετά την εισαγωγή με αντικαταστάσεις εκπαιδευτικών (' + input.replacing.source.modifiedAfterImport.replacements.map(item => (item.fromName || '?') + ' → ' + (item.toName || '?')).join(', ') + '). Βεβαιώσου ότι οι αντικαταστάσεις έχουν περάσει και στο FET.');
    }

    result.counts = {activities: activities.size, rows: rows.length, teachers: teacherNames.length, matched: teacherNames.length - result.unmatchedTeachers.length};
    result.ok = true;
    // Για τη δεύτερη φάση (buildFetProgram). Δεν προορίζονται για εμφάνιση.
    Object.defineProperty(result, 'plan', {enumerable: false, value: {activities, fet, teacherMatch, hierarchy, classes, hours, dayNumber}});
    return result;
  }

  // Κατασκευή του προγράμματος από την ανάλυση (δεύτερη φάση).
  //   options: {unmatched:'keep'|'drop', kind ('school'), name, periodId (ή null για προσχέδιο), now}.
  function buildFetProgram(analysis, options = {}) {
    if (!analysis?.ok || !analysis.plan) throw Error('Η εισαγωγή δεν μπορεί να γίνει: ' + (analysis?.errors?.[0] || 'δεν έγινε ανάλυση.'));
    const {activities, fet, teacherMatch, hierarchy, classes, dayNumber} = analysis.plan;
    const keepUnmatched = options.unmatched !== 'drop', at = options.now || nowIso();
    const hourByName = new Map(analysis.plan.hours.map(item => [item.name, item]));
    const programActivities = [], sourceActivities = {};
    for (const activity of activities.values()) {
      const id = 'fet-' + activity.fetId, students = expandStudents(activity.studentsSets, hierarchy, classes);
      const matched = activity.teachers.map(name => teacherMatch.get(name)).filter(Boolean);
      const unmatched = keepUnmatched ? activity.teachers.filter(name => !teacherMatch.get(name)) : [];
      programActivities.push({id, subject: activity.subject, staff: unique(matched), unmatched: unique(unmatched), classes: students.classes, subsets: students.subsets, room: activity.room, times: activity.times});
      sourceActivities[id] = {fetId: activity.fetId, tags: fet.activities.get(activity.fetId)?.tags || activity.csvTags, students: activity.studentsSets};
    }
    const unavailable = fet.unavailable.map(item => {
      const hour = hourByName.get(item.hour), day = dayNumber(item.day);
      return hour && day ? {teacher: item.teacher, day, hour: item.hour, start: hour.start, end: hour.end, weight: item.weight} : null;
    }).filter(Boolean);
    return {
      id: options.id || uid(), formatVersion: 1, kind: options.kind || 'school', periodId: options.periodId ?? null,
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
  // Τον χρησιμοποιούν το «Σχολικά Προγράμματα» (προγράμματα περιόδων) και η εφαρμογή-κάτοχος του είδους,
  // με τον κοινό διάλογο schoolProgramImport του _ui.js. Τα αρχεία τα διαβάζει το host.
  //   id         μοναδικό μέσα στο είδος (π.χ. 'fet')
  //   label      η ενέργεια για τον χρήστη (π.χ. «Εισαγωγή από FET»)
  //   intro      τι αρχεία ζητά, για τον διάλογο
  //   files      [{key, label, description, accept:{mime:[καταλήξεις]}}]: τα αρχεία, με τη σειρά τους
  //   analyze(files, {staff, teachingHours, replacing})
  //              files: {key: {name, text}}. → {ok, errors, warnings, info, unmatchedTeachers, summary:[{value, label}]}
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
        const analysis = analyzeFetImport({csvText: files.csv?.text, csvName: files.csv?.name, fetText: files.fet?.text, fetName: files.fet?.name, staff: options.staff, teachingHours: options.teachingHours, replacing: options.replacing});
        if (analysis.ok) {
          const preview = buildFetProgram(analysis, {unmatched: 'keep'});
          analysis.summary = [
            {value: analysis.counts.activities, label: 'δραστηριότητες'},
            {value: analysis.counts.rows, label: 'ώρες στο πρόγραμμα'},
            {value: unique(preview.activities.flatMap(activity => activity.classes)).length, label: 'τμήματα'},
            {value: analysis.counts.matched + '/' + analysis.counts.teachers, label: 'εκπαιδευτικοί με αντιστοίχιση'}
          ];
        }
        return analysis;
      },
      build: (analysis, options = {}) => buildFetProgram(analysis, options)
    });
  }

  // Ο εισαγωγέας του Ολοημέρου: το CSV που εξάγει ο Ολοήμερο Designer για το FET (και το παλιό αρχείο
  // του Designer, που έχει την ίδια μορφή). Ημέρες και ώρες από τις ετικέτες των Ωρών Διδασκαλίας.
  function oloimeroImporter() {
    return Object.freeze({
      id: 'csv',
      label: 'Εισαγωγή από CSV Ολοημέρου',
      intro: 'Επίλεξε το CSV που εξάγει ο Ολοήμερο Designer για το FET.',
      files: Object.freeze([
        Object.freeze({key: 'csv', label: 'CSV Ολοημέρου', description: 'CSV του Ολοήμερου Designer', accept: Object.freeze({'text/csv': ['.csv']})})
      ]),
      analyze(files, options = {}) {
        const analysis = analyzeOloimeroImport({csvText: files.csv?.text, csvName: files.csv?.name, staff: options.staff, teachingHours: options.teachingHours});
        if (analysis.ok) {
          analysis.summary = [
            {value: analysis.counts.activities, label: 'δραστηριότητες'},
            {value: analysis.counts.classes, label: 'τμήματα'},
            {value: analysis.counts.matched + '/' + analysis.counts.teachers, label: 'εκπαιδευτικοί με αντιστοίχιση'}
          ];
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

  window.SchoolCsv = Object.freeze({parse, quote, detectDelimiter, staffCsvRead, staffCsvUpdate, staffCsvSuggest});
  window.SchoolFet = Object.freeze({parse: parseFet, child, children, text});
  window.SchoolText = Object.freeze({withoutTones, weekdayIndex});
  window.SchoolDate = Object.freeze({valid: isoValid, format: formatDate, parse: parseDate, schoolYear: schoolYearRange, schoolYearTeachingEnd, inSchoolYear, today, weekday: isoWeekday});
  window.SchoolTimetable = Object.freeze({
    kinds: KINDS, countsInHours, importers: importersOf, importer: importerOf, hourGroupKeys: HOUR_GROUPS, dayLabels: DAY_LABELS,
    STAY_MINUTES, EARLY_ARRIVAL_MINUTES,
    parseTimeRange, hourTimes, timedHours, hourGroups,
    periodEnd, periodAt, programAt, programsAt, periodWarnings,
    homeroomClasses, classSpelling, studentsIndex, expandStudents, studentsFromNames, studentsText, homeroomTeacher, isGeneralTeacher, sortStaff,
    conflicts, studentsClash, staffHours, unavailableTimes, availability, replaceStaff,
    analyzeOloimeroReplace, applyOloimeroReplace,
    OLOIMERO_CATEGORIES, OLOIMERO_MAX_SLOTS, oloimeroHours, oloimeroTeacherColor, oloimeroStudents,
    oloimeroRowsFromCsv, oloimeroRowsFromProgram, oloimeroCsvFromProgram, analyzeOloimeroImport, buildOloimeroProgram,
    analyzeFetImport, buildFetProgram
  });
})();
